import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateProductDto } from './dto/create-product.dto.js';
import type { QueryProductsDto } from './dto/query-products.dto.js';
import type { ProductWithCategory } from './products.mapper.js';
import { ProductsService } from './products.service.js';

const PRODUCT_ID = '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f';
const CATEGORY_ID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';
const OTHER_ID = '3d4e5f6a-7b8c-4d9e-8f0a-1b2c3d4e5f6a';
const USER_ID = '4f1c9f5e-4c0f-4d4a-9e0b-7a9f5b2d3c11';

const TIMESTAMP = new Date('2026-02-10T14:30:00.000Z');

function productRecord(
  overrides: Partial<ProductWithCategory> = {},
): ProductWithCategory {
  return {
    id: PRODUCT_ID,
    sku: 'BEB-001',
    barcode: '7701000000011',
    name: 'Agua Cristal 600 ml',
    description: 'Agua purificada sin gas',
    categoryId: CATEGORY_ID,
    costPrice: new Prisma.Decimal(1200),
    salePrice: new Prisma.Decimal(2000),
    stock: 0,
    minStock: 24,
    unit: 'botella',
    imageUrl: null,
    active: true,
    deletedAt: null,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    category: { id: CATEGORY_ID, name: 'Bebidas' },
    ...overrides,
  };
}

function createDto(overrides: Partial<CreateProductDto> = {}): CreateProductDto {
  return {
    sku: 'BEB-001',
    barcode: '7701000000011',
    name: 'Agua Cristal 600 ml',
    description: 'Agua purificada sin gas',
    categoryId: CATEGORY_ID,
    costPrice: 1200,
    salePrice: 2000,
    minStock: 24,
    unit: 'botella',
    ...overrides,
  };
}

function createMocks() {
  const productFindFirst = jest.fn<
    (args: {
      where?: unknown;
      select?: unknown;
      include?: unknown;
    }) => Promise<unknown>
  >();
  const productCreate = jest.fn<
    (args: {
      data: unknown;
      include?: unknown;
    }) => Promise<ProductWithCategory>
  >();
  const productUpdate = jest.fn<
    (args: {
      where: { id: string };
      data: unknown;
      include?: unknown;
    }) => Promise<ProductWithCategory>
  >();
  const productCount = jest.fn<(args: { where?: unknown }) => Promise<number>>();
  const productFindMany = jest.fn<
    (args: {
      where?: unknown;
      include?: unknown;
      orderBy?: unknown;
      skip?: number;
      take?: number;
    }) => Promise<ProductWithCategory[]>
  >();
  const priceHistoryCreateMany = jest.fn<
    (args: { data: unknown }) => Promise<{ count: number }>
  >();

  const minStockField = { $field: 'product.minStock' };

  const rawPrisma = {
    product: {
      findFirst: productFindFirst,
      create: productCreate,
      update: productUpdate,
      count: productCount,
      findMany: productFindMany,
      fields: { minStock: minStockField },
    },
    priceHistory: { createMany: priceHistoryCreateMany },
    category: {
      findUnique: jest.fn<
        (args: {
          where: { id: string };
          select?: unknown;
        }) => Promise<{ id: string; active: boolean } | null>
      >(),
    },
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
    service: new ProductsService(prisma),
    productFindFirst,
    productCreate,
    productUpdate,
    productCount,
    productFindMany,
    priceHistoryCreateMany,
    categoryFindUnique: rawPrisma.category.findUnique,
    minStockField,
  };
}

describe('ProductsService', () => {
  it('normaliza el SKU y registra los precios iniciales COST y SALE', async () => {
    const {
      service,
      categoryFindUnique,
      productFindFirst,
      productCreate,
      priceHistoryCreateMany,
    } = createMocks();

    categoryFindUnique.mockResolvedValue({ id: CATEGORY_ID, active: true });
    productFindFirst.mockResolvedValue(null);
    productCreate.mockResolvedValue(productRecord());
    priceHistoryCreateMany.mockResolvedValue({ count: 2 });

    const result = await service.create(
      createDto({ sku: '  beb-001  ' }),
      USER_ID,
    );

    const data = productCreate.mock.calls[0]?.[0].data as {
      sku: string;
      stock: number;
      categoryId: string;
    };

    expect(data.sku).toBe('BEB-001');
    expect(data.stock).toBe(0);
    expect(data.categoryId).toBe(CATEGORY_ID);

    const history = priceHistoryCreateMany.mock.calls[0]?.[0].data as Array<{
      field: string;
      oldValue: number;
      newValue: number;
      changedById: string;
    }>;

    expect(history).toHaveLength(2);
    expect(history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'COST',
          oldValue: 0,
          newValue: 1200,
          changedById: USER_ID,
        }),
        expect.objectContaining({
          field: 'SALE',
          oldValue: 0,
          newValue: 2000,
          changedById: USER_ID,
        }),
      ]),
    );
    expect(result.stock).toBe(0);
  });

  it('rechaza un payload con stock al crear', async () => {
    const { service } = createMocks();
    const payload = { ...createDto(), stock: 10 } as unknown as CreateProductDto;

    await expect(service.create(payload, USER_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza el SKU duplicado', async () => {
    const { service, categoryFindUnique, productFindFirst } = createMocks();

    categoryFindUnique.mockResolvedValue({ id: CATEGORY_ID, active: true });
    productFindFirst.mockResolvedValue({ id: OTHER_ID });

    await expect(service.create(createDto(), USER_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rechaza el código de barras duplicado', async () => {
    const { service, categoryFindUnique, productFindFirst } = createMocks();

    categoryFindUnique.mockResolvedValue({ id: CATEGORY_ID, active: true });
    productFindFirst.mockImplementation(async (args) => {
      const where = args.where as { sku?: unknown; barcode?: unknown };

      return where.barcode ? { id: OTHER_ID } : null;
    });

    await expect(service.create(createDto(), USER_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('registra PriceHistory al cambiar el precio de venta', async () => {
    const {
      service,
      productFindFirst,
      productUpdate,
      priceHistoryCreateMany,
    } = createMocks();

    productFindFirst.mockImplementation(async (args) => {
      const where = args.where as { id?: string };

      if (where.id) {
        return {
          id: PRODUCT_ID,
          sku: 'BEB-001',
          barcode: '7701000000011',
          costPrice: new Prisma.Decimal(1200),
          salePrice: new Prisma.Decimal(2000),
        };
      }

      return null;
    });
    productUpdate.mockResolvedValue(
      productRecord({ salePrice: new Prisma.Decimal(2200) }),
    );
    priceHistoryCreateMany.mockResolvedValue({ count: 1 });

    await service.update(PRODUCT_ID, { salePrice: 2200 }, USER_ID);

    const history = priceHistoryCreateMany.mock.calls[0]?.[0].data as Array<{
      productId: string;
      field: string;
      oldValue: number;
      newValue: number;
      changedById: string;
    }>;

    expect(history).toEqual([
      {
        productId: PRODUCT_ID,
        field: 'SALE',
        oldValue: 2000,
        newValue: 2200,
        changedById: USER_ID,
      },
    ]);
  });

  it('filtra por stock bajo comparando stock con minStock', async () => {
    const { service, productCount, productFindMany, minStockField } =
      createMocks();

    productCount.mockResolvedValue(0);
    productFindMany.mockResolvedValue([]);

    const query = {
      page: 1,
      pageSize: 20,
      sort: 'name',
      order: 'asc',
      lowStock: 'true',
    } as QueryProductsDto;

    await service.list(query);

    const where = productFindMany.mock.calls[0]?.[0].where as {
      stock?: { lte?: unknown };
    };

    expect(where.stock).toEqual({ lte: minStockField });
  });
});
