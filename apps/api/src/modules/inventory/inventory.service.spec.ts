import { describe, expect, it, jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StockMovementType } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateMovementDto } from './dto/create-movement.dto.js';
import type { QueryLowStockDto } from './dto/query-low-stock.dto.js';
import type { QueryMovementsDto } from './dto/query-movements.dto.js';
import type { QueryProductMovementsDto } from './dto/query-product-movements.dto.js';
import type { StockMovementWithRelations } from './inventory.mapper.js';
import { InventoryService } from './inventory.service.js';

const MOVEMENT_ID = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f3a4b5c6d';
const PRODUCT_ID = '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f';
const CATEGORY_ID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';
const USER_ID = '4f1c9f5e-4c0f-4d4a-9e0b-7a9f5b2d3c11';
const OTHER_ID = '3d4e5f6a-7b8c-4d9e-8f0a-1b2c3d4e5f6a';

const TIMESTAMP = new Date('2026-02-12T09:15:00.000Z');

type LockedProduct = {
  id: string;
  sku: string;
  name: string;
  stock: number;
  costPrice: Prisma.Decimal;
  deletedAt: Date | null;
};

function productRow(overrides: Partial<LockedProduct> = {}): LockedProduct {
  return {
    id: PRODUCT_ID,
    sku: 'BEB-001',
    name: 'Agua Cristal 600 ml',
    stock: 10,
    costPrice: new Prisma.Decimal(1000),
    deletedAt: null,
    ...overrides,
  };
}

function movementRecord(
  overrides: Partial<StockMovementWithRelations> = {},
): StockMovementWithRelations {
  return {
    id: MOVEMENT_ID,
    productId: PRODUCT_ID,
    type: StockMovementType.ENTRY,
    quantity: 10,
    previousStock: 10,
    newStock: 20,
    unitCost: new Prisma.Decimal(2000),
    reason: null,
    saleId: null,
    userId: USER_ID,
    createdAt: TIMESTAMP,
    product: { id: PRODUCT_ID, sku: 'BEB-001', name: 'Agua Cristal 600 ml' },
    user: { id: USER_ID, name: 'Administrador POS', email: 'admin@pos.local' },
    ...overrides,
  };
}

function entryDto(overrides: Partial<CreateMovementDto> = {}): CreateMovementDto {
  return {
    productId: PRODUCT_ID,
    type: 'ENTRY',
    quantity: 10,
    unitCost: 2000,
    ...overrides,
  };
}

function adjustmentDto(
  overrides: Partial<CreateMovementDto> = {},
): CreateMovementDto {
  return {
    productId: PRODUCT_ID,
    type: 'ADJUSTMENT',
    quantity: -3,
    reason: 'Empaques rotos en bodega',
    ...overrides,
  };
}

function createMocks() {
  const queryRaw = jest.fn<(...args: unknown[]) => Promise<unknown>>(() =>
    Promise.resolve([]),
  );
  const productFindUnique = jest.fn<
    (args: { where: { id: string }; select?: unknown }) => Promise<unknown>
  >();
  const productFindFirst = jest.fn<
    (args: { where?: unknown; select?: unknown }) => Promise<unknown>
  >();
  const productFindMany = jest.fn<
    (args: {
      where?: unknown;
      select?: unknown;
      orderBy?: unknown;
      skip?: number;
      take?: number;
    }) => Promise<unknown[]>
  >();
  const productUpdate = jest.fn<
    (args: { where: { id: string }; data: unknown }) => Promise<unknown>
  >();
  const productCount = jest.fn<(args: { where?: unknown }) => Promise<number>>();
  const movementCreate = jest.fn<
    (args: {
      data: unknown;
      include?: unknown;
    }) => Promise<StockMovementWithRelations>
  >();
  const movementCount = jest.fn<
    (args: { where?: unknown }) => Promise<number>
  >();
  const movementFindMany = jest.fn<
    (args: {
      where?: unknown;
      include?: unknown;
      orderBy?: unknown;
      skip?: number;
      take?: number;
    }) => Promise<StockMovementWithRelations[]>
  >();
  const priceHistoryCreate = jest.fn<
    (args: { data: unknown }) => Promise<unknown>
  >();

  const minStockField = { $field: 'product.minStock' };

  const rawPrisma = {
    $queryRaw: queryRaw,
    product: {
      findUnique: productFindUnique,
      findFirst: productFindFirst,
      findMany: productFindMany,
      update: productUpdate,
      count: productCount,
      fields: { minStock: minStockField },
    },
    stockMovement: {
      create: movementCreate,
      count: movementCount,
      findMany: movementFindMany,
    },
    priceHistory: { create: priceHistoryCreate },
    $transaction: jest.fn(),
  };

  rawPrisma.$transaction = jest.fn(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: unknown) => Promise<unknown>)(rawPrisma);
    }

    return Promise.all(arg as Promise<unknown>[]);
  }) as unknown as typeof rawPrisma.$transaction;

  const prisma = rawPrisma as unknown as PrismaService;

  return {
    service: new InventoryService(prisma),
    queryRaw,
    productFindUnique,
    productFindFirst,
    productFindMany,
    productUpdate,
    productCount,
    movementCreate,
    movementCount,
    movementFindMany,
    priceHistoryCreate,
    minStockField,
  };
}

describe('InventoryService', () => {
  describe('createMovement', () => {
    it('calcula el costo promedio ponderado y crea movimiento e historial', async () => {
      const {
        service,
        queryRaw,
        productFindUnique,
        productUpdate,
        movementCreate,
        priceHistoryCreate,
      } = createMocks();

      productFindUnique.mockResolvedValue(productRow());
      productUpdate.mockResolvedValue({ id: PRODUCT_ID });
      priceHistoryCreate.mockResolvedValue({ id: MOVEMENT_ID });
      movementCreate.mockResolvedValue(
        movementRecord({ unitCost: new Prisma.Decimal(1500) }),
      );

      const result = await service.createMovement(entryDto(), USER_ID);

      expect(queryRaw).toHaveBeenCalledTimes(1);
      expect(productFindUnique).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
        select: expect.objectContaining({ stock: true, costPrice: true }),
      });

      const updateData = productUpdate.mock.calls[0]?.[0].data as {
        stock: number;
        costPrice: number;
      };

      expect(updateData).toMatchObject({ stock: 20, costPrice: 1500 });

      const historyData = priceHistoryCreate.mock.calls[0]?.[0].data as {
        productId: string;
        field: string;
        oldValue: number;
        newValue: number;
        changedById: string;
      };

      expect(historyData).toMatchObject({
        productId: PRODUCT_ID,
        field: 'COST',
        oldValue: 1000,
        newValue: 1500,
        changedById: USER_ID,
      });

      const movementData = movementCreate.mock.calls[0]?.[0].data as {
        type: string;
        quantity: number;
        previousStock: number;
        newStock: number;
        unitCost: number;
        reason: string | null;
        userId: string;
      };

      expect(movementData).toMatchObject({
        type: 'ENTRY',
        quantity: 10,
        previousStock: 10,
        newStock: 20,
        unitCost: 2000,
        reason: null,
        userId: USER_ID,
      });

      expect(result).toMatchObject({
        id: MOVEMENT_ID,
        previousStock: 10,
        newStock: 20,
        unitCost: 1500,
      });
      expect(result.product).toEqual({
        id: PRODUCT_ID,
        sku: 'BEB-001',
        name: 'Agua Cristal 600 ml',
      });
    });

    it('usa el unitCost como nuevo costo cuando el stock está en 0', async () => {
      const {
        service,
        productFindUnique,
        productUpdate,
        movementCreate,
        priceHistoryCreate,
      } = createMocks();

      productFindUnique.mockResolvedValue(
        productRow({ stock: 0, costPrice: new Prisma.Decimal(1000) }),
      );
      productUpdate.mockResolvedValue({ id: PRODUCT_ID });
      priceHistoryCreate.mockResolvedValue({ id: MOVEMENT_ID });
      movementCreate.mockResolvedValue(
        movementRecord({
          quantity: 5,
          previousStock: 0,
          newStock: 5,
          unitCost: new Prisma.Decimal(2500),
        }),
      );

      await service.createMovement(
        entryDto({ quantity: 5, unitCost: 2500 }),
        USER_ID,
      );

      const updateData = productUpdate.mock.calls[0]?.[0].data as {
        stock: number;
        costPrice: number;
      };

      expect(updateData).toMatchObject({ stock: 5, costPrice: 2500 });
      expect(priceHistoryCreate).toHaveBeenCalledTimes(1);
    });

    it('no registra historial cuando el costo promedio no cambia', async () => {
      const {
        service,
        productFindUnique,
        productUpdate,
        movementCreate,
        priceHistoryCreate,
      } = createMocks();

      productFindUnique.mockResolvedValue(productRow());
      productUpdate.mockResolvedValue({ id: PRODUCT_ID });
      movementCreate.mockResolvedValue(
        movementRecord({
          quantity: 10,
          previousStock: 10,
          newStock: 20,
          unitCost: new Prisma.Decimal(1000),
        }),
      );

      await service.createMovement(
        entryDto({ quantity: 10, unitCost: 1000 }),
        USER_ID,
      );

      const updateData = productUpdate.mock.calls[0]?.[0].data as {
        costPrice: number;
      };

      expect(updateData.costPrice).toBe(1000);
      expect(priceHistoryCreate).not.toHaveBeenCalled();
    });

    it('rechaza un ajuste que dejaría el stock en negativo', async () => {
      const {
        service,
        productFindUnique,
        productUpdate,
        movementCreate,
      } = createMocks();

      productFindUnique.mockResolvedValue(productRow({ stock: 3 }));

      await expect(
        service.createMovement(adjustmentDto({ quantity: -7 }), USER_ID),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(productUpdate).not.toHaveBeenCalled();
      expect(movementCreate).not.toHaveBeenCalled();
    });

    it('rechaza un ajuste sin motivo', async () => {
      const { service, productFindUnique } = createMocks();

      await expect(
        service.createMovement(adjustmentDto({ reason: '   ' }), USER_ID),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(productFindUnique).not.toHaveBeenCalled();
    });

    it('rechaza una entrada con cantidad negativa o cero', async () => {
      const { service, productFindUnique } = createMocks();

      await expect(
        service.createMovement(entryDto({ quantity: -5 }), USER_ID),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.createMovement(entryDto({ quantity: 0 }), USER_ID),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(productFindUnique).not.toHaveBeenCalled();
    });

    it('el ajuste ignora el unitCost recibido y guarda el costo vigente', async () => {
      const { service, productFindUnique, productUpdate, movementCreate } =
        createMocks();

      productFindUnique.mockResolvedValue(productRow({ stock: 10 }));
      productUpdate.mockResolvedValue({ id: PRODUCT_ID });
      movementCreate.mockResolvedValue(
        movementRecord({ type: StockMovementType.ADJUSTMENT, quantity: -4 }),
      );

      await service.createMovement(
        adjustmentDto({ quantity: -4, unitCost: 99_000 }),
        USER_ID,
      );

      const updateData = productUpdate.mock.calls[0]?.[0].data as {
        stock: number;
        costPrice?: number;
      };

      expect(updateData).toEqual({ stock: 6 });

      const movementData = movementCreate.mock.calls[0]?.[0].data as {
        unitCost: number;
        newStock: number;
        reason: string | null;
      };

      expect(movementData).toMatchObject({
        unitCost: 1000,
        newStock: 6,
        reason: 'Empaques rotos en bodega',
      });
    });

    it('responde 404 cuando el producto no existe o está eliminado', async () => {
      const { service, productFindUnique, productUpdate } = createMocks();

      productFindUnique.mockResolvedValue(null);

      await expect(
        service.createMovement(entryDto(), USER_ID),
      ).rejects.toBeInstanceOf(NotFoundException);

      productFindUnique.mockResolvedValue(
        productRow({ deletedAt: TIMESTAMP }),
      );

      await expect(
        service.createMovement(entryDto(), USER_ID),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(productUpdate).not.toHaveBeenCalled();
    });
  });

  describe('listMovements', () => {
    it('filtra por producto, tipo y rango de fechas con paginación', async () => {
      const { service, movementCount, movementFindMany } = createMocks();

      movementCount.mockResolvedValue(1);
      movementFindMany.mockResolvedValue([
        movementRecord({ type: StockMovementType.SALE, saleId: OTHER_ID }),
      ]);

      const query = {
        page: 2,
        pageSize: 1,
        productId: PRODUCT_ID,
        type: 'SALE',
        from: '2026-02-01T00:00:00.000Z',
        to: '2026-02-28T23:59:59.999Z',
      } as QueryMovementsDto;

      const result = await service.listMovements(query);

      const where = movementFindMany.mock.calls[0]?.[0].where as Record<
        string,
        unknown
      >;

      expect(where).toMatchObject({
        productId: PRODUCT_ID,
        type: StockMovementType.SALE,
        createdAt: {
          gte: new Date('2026-02-01T00:00:00.000Z'),
          lte: new Date('2026-02-28T23:59:59.999Z'),
        },
      });

      expect(movementFindMany.mock.calls[0]?.[0].orderBy).toEqual([
        { createdAt: 'desc' },
        { id: 'desc' },
      ]);

      expect(result.meta).toEqual({
        page: 2,
        pageSize: 1,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: true,
      });
      expect(result.data[0]).toMatchObject({
        type: StockMovementType.SALE,
        saleId: OTHER_ID,
      });
    });

    it('rechaza una fecha de filtro inválida', async () => {
      const { service, movementFindMany } = createMocks();

      await expect(
        service.listMovements({
          page: 1,
          pageSize: 20,
          from: 'ayer',
        } as QueryMovementsDto),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(movementFindMany).not.toHaveBeenCalled();
    });
  });

  describe('productMovements', () => {
    it('responde 404 si el producto no existe o fue eliminado', async () => {
      const { service, productFindFirst, movementFindMany } = createMocks();

      productFindFirst.mockResolvedValue(null);

      const query = { page: 1, pageSize: 20 } as QueryProductMovementsDto;

      await expect(
        service.productMovements(PRODUCT_ID, query),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(movementFindMany).not.toHaveBeenCalled();
    });
  });

  describe('lowStock', () => {
    it('filtra por stock <= minStock sobre productos activos', async () => {
      const { service, productCount, productFindMany, minStockField } =
        createMocks();

      productCount.mockResolvedValue(0);
      productFindMany.mockResolvedValue([]);

      const query = {
        page: 1,
        pageSize: 20,
        search: 'agua',
        categoryId: CATEGORY_ID,
      } as QueryLowStockDto;

      const result = await service.lowStock(query);

      const args = productFindMany.mock.calls[0]?.[0];
      const where = args?.where as Record<string, unknown>;

      expect(where).toMatchObject({
        active: true,
        deletedAt: null,
        stock: { lte: minStockField },
        categoryId: CATEGORY_ID,
      });
      expect(args?.orderBy).toEqual([
        { stock: 'asc' },
        { name: 'asc' },
        { id: 'asc' },
      ]);
      expect(result.meta).toEqual({
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('calcula el déficit y la valorización de cada producto crítico', async () => {
      const { service, productCount, productFindMany } = createMocks();

      productCount.mockResolvedValue(1);
      productFindMany.mockResolvedValue([
        {
          id: PRODUCT_ID,
          sku: 'BEB-001',
          name: 'Agua Cristal 600 ml',
          stock: 4,
          minStock: 24,
          unit: 'botella',
          costPrice: new Prisma.Decimal(1200),
          category: { id: CATEGORY_ID, name: 'Bebidas' },
        },
      ]);

      const result = await service.lowStock({
        page: 1,
        pageSize: 20,
      } as QueryLowStockDto);

      expect(result.data[0]).toMatchObject({
        id: PRODUCT_ID,
        stock: 4,
        minStock: 24,
        deficit: 20,
        costPrice: 1200,
        inventoryValue: 4800,
        lowStock: true,
      });
      expect(result.data[0]?.category).toEqual({
        id: CATEGORY_ID,
        name: 'Bebidas',
      });
    });
  });

  describe('summary', () => {
    it('agrega unidades, valorización, stock bajo y agotados', async () => {
      const { service, productFindMany } = createMocks();

      productFindMany.mockResolvedValue([
        { stock: 10, minStock: 24, costPrice: new Prisma.Decimal(1000) },
        { stock: 0, minStock: 5, costPrice: new Prisma.Decimal(2000) },
        { stock: 40, minStock: 5, costPrice: new Prisma.Decimal(500) },
      ]);

      const result = await service.summary();

      const where = productFindMany.mock.calls[0]?.[0].where as Record<
        string,
        unknown
      >;

      expect(where).toMatchObject({ active: true, deletedAt: null });
      expect(result).toMatchObject({
        totalProducts: 3,
        totalUnits: 50,
        inventoryValue: 30_000,
        lowStockCount: 2,
        outOfStockCount: 1,
      });
      expect(Number.isNaN(Date.parse(result.generatedAt))).toBe(false);
    });

    it('devuelve un resumen en ceros cuando no hay productos activos', async () => {
      const { service, productFindMany } = createMocks();

      productFindMany.mockResolvedValue([]);

      await expect(service.summary()).resolves.toMatchObject({
        totalProducts: 0,
        totalUnits: 0,
        inventoryValue: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
      });
    });
  });
});
