import { describe, expect, it, jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentMethod,
  Prisma,
  SaleStatus,
  StockMovementType,
} from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateSaleDto } from './dto/create-sale.dto.js';
import type { QuerySalesDto } from './dto/query-sales.dto.js';
import type { VoidSaleDto } from './dto/void-sale.dto.js';
import {
  computeSaleTotals,
  distributeDiscountCents,
  fromCents,
  toCents,
} from './sales.calculator.js';
import type {
  SaleDetailRecord,
  SaleItemRecord,
  SalePaymentRecord,
  SaleSummaryRecord,
} from './sales.mapper.js';
import { SalesService } from './sales.service.js';

const SALE_ID = '3c4d5e6f-7a8b-4c9d-9e0f-1a2b3c4d5e6f';
const ITEM_ID = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f3a4b5c6d';
const SECOND_ITEM_ID = '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b';
const PAYMENT_ID = '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e';
const PRODUCT_ID = '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f';
const SECOND_PRODUCT_ID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';
const USER_ID = '4f1c9f5e-4c0f-4d4a-9e0b-7a9f5b2d3c11';

const TIMESTAMP = new Date('2026-02-12T09:15:00.000Z');

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  stock: number;
  costPrice: Prisma.Decimal;
  salePrice: Prisma.Decimal;
  active: boolean;
  deletedAt: Date | null;
};

type SaleCreateData = {
  number: bigint;
  status: SaleStatus;
  userId: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  costTotal: number;
  profit: number;
  items: { create: SaleItemCreateData[] };
};

type SaleItemCreateData = {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  lineSubtotal: number;
  lineDiscount: number;
  lineTax: number;
  lineTotal: number;
  lineProfit: number;
};

type PaymentCreateData = {
  saleId: string;
  method: PaymentMethod;
  amount: number;
  cashReceived: number | null;
  changeGiven: number | null;
};

type MovementCreateData = {
  productId: string;
  type: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  unitCost: number;
  reason?: string;
  saleId?: string;
  userId?: string;
};

function productRow(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: PRODUCT_ID,
    sku: 'BEB-001',
    name: 'Agua Cristal 600 ml',
    stock: 10,
    costPrice: new Prisma.Decimal(6500),
    salePrice: new Prisma.Decimal(10000),
    active: true,
    deletedAt: null,
    ...overrides,
  };
}

function saleItemRecord(
  overrides: Partial<SaleItemRecord> = {},
): SaleItemRecord {
  return {
    id: ITEM_ID,
    productId: PRODUCT_ID,
    productName: 'Agua Cristal 600 ml',
    sku: 'BEB-001',
    quantity: 2,
    unitPrice: new Prisma.Decimal(10000),
    unitCost: new Prisma.Decimal(6500),
    lineSubtotal: new Prisma.Decimal(20000),
    lineDiscount: new Prisma.Decimal(2000),
    lineTax: new Prisma.Decimal(2873.95),
    lineTotal: new Prisma.Decimal(18000),
    lineProfit: new Prisma.Decimal(2126.05),
    ...overrides,
  };
}

function salePaymentRecord(
  overrides: Partial<SalePaymentRecord> = {},
): SalePaymentRecord {
  return {
    id: PAYMENT_ID,
    method: PaymentMethod.CASH,
    amount: new Prisma.Decimal(32130),
    cashReceived: new Prisma.Decimal(40230),
    changeGiven: new Prisma.Decimal(8100),
    createdAt: TIMESTAMP,
    ...overrides,
  };
}

function saleSummaryRecord(
  overrides: Partial<SaleSummaryRecord> = {},
): SaleSummaryRecord {
  return {
    id: SALE_ID,
    number: 1n,
    status: SaleStatus.COMPLETED,
    userId: USER_ID,
    subtotal: new Prisma.Decimal(35700),
    discountAmount: new Prisma.Decimal(3570),
    taxAmount: new Prisma.Decimal(5130),
    total: new Prisma.Decimal(32130),
    costTotal: new Prisma.Decimal(24000),
    profit: new Prisma.Decimal(3000),
    createdAt: TIMESTAMP,
    voidedAt: null,
    voidedById: null,
    voidReason: null,
    user: { id: USER_ID, name: 'Administrador POS', email: 'admin@pos.local' },
    payments: [{ method: PaymentMethod.CASH }],
    _count: { items: 2 },
    ...overrides,
  };
}

function saleDetailRecord(
  overrides: Partial<SaleDetailRecord> = {},
): SaleDetailRecord {
  return {
    id: SALE_ID,
    number: 1n,
    status: SaleStatus.COMPLETED,
    userId: USER_ID,
    subtotal: new Prisma.Decimal(35700),
    discountAmount: new Prisma.Decimal(3570),
    taxAmount: new Prisma.Decimal(5130),
    total: new Prisma.Decimal(32130),
    costTotal: new Prisma.Decimal(24000),
    profit: new Prisma.Decimal(3000),
    createdAt: TIMESTAMP,
    voidedAt: null,
    voidedById: null,
    voidReason: null,
    user: { id: USER_ID, name: 'Administrador POS', email: 'admin@pos.local' },
    voidedBy: null,
    items: [
      saleItemRecord(),
      saleItemRecord({
        id: SECOND_ITEM_ID,
        productId: SECOND_PRODUCT_ID,
        productName: 'Gaseosa 400 ml',
        sku: 'BEB-002',
        quantity: 1,
        unitPrice: new Prisma.Decimal(15700),
        unitCost: new Prisma.Decimal(11000),
        lineSubtotal: new Prisma.Decimal(15700),
        lineDiscount: new Prisma.Decimal(1570),
        lineTax: new Prisma.Decimal(2256.05),
        lineTotal: new Prisma.Decimal(14130),
        lineProfit: new Prisma.Decimal(873.95),
      }),
    ],
    payments: [salePaymentRecord()],
    ...overrides,
  };
}

function createSaleDto(overrides: Partial<CreateSaleDto> = {}): CreateSaleDto {
  return {
    items: [
      { productId: PRODUCT_ID, quantity: 2 },
      { productId: SECOND_PRODUCT_ID, quantity: 1 },
    ],
    discountAmount: 3570,
    payment: { method: 'CASH', cashReceived: 40230 },
    ...overrides,
  };
}

function voidSaleDto(reason = 'Error de digitación'): VoidSaleDto {
  return { reason };
}

function createMocks() {
  const queryRaw = jest.fn<(...args: unknown[]) => Promise<unknown>>(
    (...args: unknown[]) => {
      const [first] = args;
      const sql = Array.isArray(first) ? first.join(' ') : '';

      return Promise.resolve(sql.includes('nextval') ? [{ value: 1n }] : []);
    },
  );
  const saleFindUnique = jest.fn<
    (args: {
      where: { id: string };
      select?: unknown;
      include?: unknown;
    }) => Promise<unknown>
  >();
  const saleCreate = jest.fn<
    (args: { data: unknown; select?: unknown }) => Promise<{ id: string }>
  >();
  const saleFindMany = jest.fn<
    (args: {
      where?: unknown;
      include?: unknown;
      orderBy?: unknown;
      skip?: number;
      take?: number;
    }) => Promise<unknown[]>
  >();
  const saleCount = jest.fn<(args: { where?: unknown }) => Promise<number>>();
  const saleUpdateMany = jest.fn<
    (args: { where: unknown; data: unknown }) => Promise<{ count: number }>
  >();
  const productFindMany = jest.fn<
    (args: { where?: unknown; select?: unknown }) => Promise<ProductRow[]>
  >();
  const productFindUnique = jest.fn<
    (args: { where: { id: string }; select?: unknown }) => Promise<{
      id: string;
      stock: number;
    } | null>
  >();
  const productUpdate = jest.fn<
    (args: { where: { id: string }; data: unknown }) => Promise<unknown>
  >();
  const productUpdateMany = jest.fn<
    (args: { where: unknown; data: unknown }) => Promise<{ count: number }>
  >();
  const paymentCreate = jest.fn<
    (args: { data: unknown }) => Promise<{ id: string }>
  >();
  const movementCreate = jest.fn<
    (args: { data: unknown }) => Promise<{ id: string }>
  >();

  const rawPrisma = {
    $queryRaw: queryRaw,
    $transaction: jest.fn(),
    sale: {
      create: saleCreate,
      findUnique: saleFindUnique,
      findMany: saleFindMany,
      count: saleCount,
      updateMany: saleUpdateMany,
    },
    product: {
      findMany: productFindMany,
      findUnique: productFindUnique,
      update: productUpdate,
      updateMany: productUpdateMany,
    },
    payment: { create: paymentCreate },
    stockMovement: { create: movementCreate },
  };

  rawPrisma.$transaction = jest.fn(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: unknown) => Promise<unknown>)(rawPrisma);
    }

    return Promise.all(arg as Promise<unknown>[]);
  }) as unknown as typeof rawPrisma.$transaction;

  const prisma = rawPrisma as unknown as PrismaService;

  return {
    service: new SalesService(prisma),
    queryRaw,
    saleCreate,
    saleFindUnique,
    saleFindMany,
    saleCount,
    saleUpdateMany,
    productFindMany,
    productFindUnique,
    productUpdate,
    productUpdateMany,
    paymentCreate,
    movementCreate,
  };
}

describe('SalesCalculator', () => {
  it('prorratea el descuento global en proporción al subtotal', () => {
    expect(distributeDiscountCents([20000, 15700], 3570)).toEqual([2000, 1570]);
    expect(distributeDiscountCents([10000, 10000], 3570)).toEqual([1785, 1785]);
  });

  it('reparte el residuo del prorrateo de a un centavo, en orden', () => {
    expect(distributeDiscountCents([1, 1, 1], 2)).toEqual([1, 1, 0]);
    expect(distributeDiscountCents([100, 100, 100], 1)).toEqual([1, 0, 0]);
    expect(distributeDiscountCents([1, 1, 1, 1], 3)).toEqual([1, 1, 1, 0]);
  });

  it('devuelve ceros sin descuento y exige descuento cero sin subtotal', () => {
    expect(distributeDiscountCents([1000, 2000], 0)).toEqual([0, 0]);
    expect(distributeDiscountCents([0, 0], 0)).toEqual([0, 0]);
    expect(() => distributeDiscountCents([0, 0], 1)).toThrow(
      BadRequestException,
    );
  });

  it('rechaza un descuento mayor al subtotal', () => {
    expect(() => distributeDiscountCents([1000, 2000], 3001)).toThrow(
      BadRequestException,
    );
  });

  it('calcula el IVA 19% incluido de una línea', () => {
    const totals = computeSaleTotals([
      { unitPriceCents: 11900, unitCostCents: 0, quantity: 1 },
    ]);

    expect(totals).toMatchObject({
      subtotal: 11900,
      discountAmount: 0,
      taxAmount: 1900,
      total: 11900,
    });
    expect(totals.lines[0]?.lineTax).toBe(1900);
  });

  it('suma totales, costo y ganancia con el descuento prorrateado', () => {
    const totals = computeSaleTotals(
      [
        {
          unitPriceCents: toCents(100),
          unitCostCents: toCents(65),
          quantity: 2,
        },
        {
          unitPriceCents: toCents(157),
          unitCostCents: toCents(110),
          quantity: 1,
        },
      ],
      toCents(35.7),
    );

    expect(totals).toMatchObject({
      subtotal: 35700,
      discountAmount: 3570,
      taxAmount: 5130,
      total: 32130,
      costTotal: 24000,
      profit: 3000,
    });
    expect(totals.lines.map((line) => line.lineDiscount)).toEqual([2000, 1570]);
    expect(fromCents(totals.total)).toBe(321.3);
    expect(totals.lines.map((line) => line.lineProfit)).toEqual([2126, 874]);
  });

  it('rechaza cantidades inválidas y descuentos inválidos', () => {
    expect(() =>
      computeSaleTotals([
        { unitPriceCents: 100, unitCostCents: 50, quantity: 0 },
      ]),
    ).toThrow(BadRequestException);
    expect(() =>
      computeSaleTotals(
        [{ unitPriceCents: 100, unitCostCents: 50, quantity: 1 }],
        101,
      ),
    ).toThrow(BadRequestException);
  });
});

describe('SalesService', () => {
  describe('create', () => {
    it('registra la venta con totales, pago, stock y movimiento SALE', async () => {
      const {
        service,
        queryRaw,
        saleCreate,
        saleFindUnique,
        productFindMany,
        productUpdateMany,
        paymentCreate,
        movementCreate,
      } = createMocks();

      productFindMany.mockResolvedValue([
        productRow(),
        productRow({
          id: SECOND_PRODUCT_ID,
          sku: 'BEB-002',
          name: 'Gaseosa 400 ml',
          stock: 5,
          costPrice: new Prisma.Decimal(11000),
          salePrice: new Prisma.Decimal(15700),
        }),
      ]);
      saleCreate.mockResolvedValue({ id: SALE_ID });
      paymentCreate.mockResolvedValue({ id: PAYMENT_ID });
      productUpdateMany.mockResolvedValue({ count: 1 });
      movementCreate.mockResolvedValue({ id: ITEM_ID });
      saleFindUnique.mockResolvedValue(saleDetailRecord());

      const result = await service.create(createSaleDto(), USER_ID);

      // Dos bloqueos FOR UPDATE y una lectura de la secuencia.
      expect(queryRaw).toHaveBeenCalledTimes(3);

      const saleData = saleCreate.mock.calls[0]?.[0]?.data as SaleCreateData;

      expect(saleData).toMatchObject({
        number: 1n,
        status: SaleStatus.COMPLETED,
        userId: USER_ID,
        subtotal: 35700,
        discountAmount: 3570,
        taxAmount: 5130,
        total: 32130,
        costTotal: 24000,
        profit: 3000,
      });
      expect(saleData.items.create).toEqual([
        {
          productId: PRODUCT_ID,
          productName: 'Agua Cristal 600 ml',
          sku: 'BEB-001',
          quantity: 2,
          unitPrice: 10000,
          unitCost: 6500,
          lineSubtotal: 20000,
          lineDiscount: 2000,
          lineTax: 2873.95,
          lineTotal: 18000,
          lineProfit: 2126.05,
        },
        {
          productId: SECOND_PRODUCT_ID,
          productName: 'Gaseosa 400 ml',
          sku: 'BEB-002',
          quantity: 1,
          unitPrice: 15700,
          unitCost: 11000,
          lineSubtotal: 15700,
          lineDiscount: 1570,
          lineTax: 2256.05,
          lineTotal: 14130,
          lineProfit: 873.95,
        },
      ]);

      const paymentData = paymentCreate.mock.calls[0]
        ?.[0]?.data as PaymentCreateData;

      expect(paymentData).toEqual({
        saleId: SALE_ID,
        method: PaymentMethod.CASH,
        amount: 32130,
        cashReceived: 40230,
        changeGiven: 8100,
      });

      expect(productUpdateMany.mock.calls.map((call) => call[0])).toEqual([
        {
          where: { id: PRODUCT_ID, stock: { gte: 2 } },
          data: { stock: { decrement: 2 } },
        },
        {
          where: { id: SECOND_PRODUCT_ID, stock: { gte: 1 } },
          data: { stock: { decrement: 1 } },
        },
      ]);

      const movements = movementCreate.mock.calls.map(
        (call) => call[0].data as MovementCreateData,
      );

      expect(movements).toEqual([
        {
          productId: PRODUCT_ID,
          type: StockMovementType.SALE,
          quantity: -2,
          previousStock: 10,
          newStock: 8,
          unitCost: 6500,
          saleId: SALE_ID,
          userId: USER_ID,
        },
        {
          productId: SECOND_PRODUCT_ID,
          type: StockMovementType.SALE,
          quantity: -1,
          previousStock: 5,
          newStock: 4,
          unitCost: 11000,
          saleId: SALE_ID,
          userId: USER_ID,
        },
      ]);

      expect(result).toMatchObject({
        number: 'V-000001',
        status: SaleStatus.COMPLETED,
        subtotal: 35700,
        discountAmount: 3570,
        taxAmount: 5130,
        total: 32130,
        costTotal: 24000,
        profit: 3000,
        itemCount: 2,
        paymentMethod: PaymentMethod.CASH,
        voidedAt: null,
        voidedBy: null,
        voidReason: null,
      });
      expect(result.payment).toMatchObject({
        method: PaymentMethod.CASH,
        amount: 32130,
        cashReceived: 40230,
        changeGiven: 8100,
      });
      expect(result.items).toHaveLength(2);
    });

    it('registra una venta con tarjeta sin efectivo ni vuelto', async () => {
      const {
        service,
        saleCreate,
        saleFindUnique,
        productFindMany,
        productUpdateMany,
        paymentCreate,
        movementCreate,
      } = createMocks();

      productFindMany.mockResolvedValue([productRow({ stock: 4 })]);
      saleCreate.mockResolvedValue({ id: SALE_ID });
      saleFindUnique.mockResolvedValue(saleDetailRecord());
      productUpdateMany.mockResolvedValue({ count: 1 });
      paymentCreate.mockResolvedValue({ id: PAYMENT_ID });
      movementCreate.mockResolvedValue({ id: ITEM_ID });

      const dto = createSaleDto({
        items: [{ productId: PRODUCT_ID, quantity: 1 }],
        discountAmount: 0,
        payment: { method: 'CARD' },
      });

      await service.create(dto, USER_ID);

      const paymentData = paymentCreate.mock.calls[0]
        ?.[0]?.data as PaymentCreateData;

      expect(paymentData).toEqual({
        saleId: SALE_ID,
        method: PaymentMethod.CARD,
        amount: 10000,
        cashReceived: null,
        changeGiven: null,
      });
    });

    it('rechaza cashReceived en un pago con tarjeta', async () => {
      const { service, productFindMany, saleCreate } = createMocks();

      const dto = createSaleDto({
        items: [{ productId: PRODUCT_ID, quantity: 1 }],
        payment: { method: 'CARD', cashReceived: 400 },
      });

      await expect(service.create(dto, USER_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(productFindMany).not.toHaveBeenCalled();
      expect(saleCreate).not.toHaveBeenCalled();
    });

    it('exige el efectivo recibido cuando el pago es en efectivo', async () => {
      const { service, productFindMany, saleCreate } = createMocks();

      productFindMany.mockResolvedValue([productRow()]);

      const dto = createSaleDto({
        items: [{ productId: PRODUCT_ID, quantity: 1 }],
        discountAmount: 0,
        payment: { method: 'CASH' },
      });

      await expect(service.create(dto, USER_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(saleCreate).not.toHaveBeenCalled();
    });

    it('rechaza un efectivo menor al total de la venta', async () => {
      const { service, productFindMany, saleCreate } = createMocks();

      productFindMany.mockResolvedValue([productRow()]);

      const dto = createSaleDto({
        items: [{ productId: PRODUCT_ID, quantity: 1 }],
        discountAmount: 0,
        payment: { method: 'CASH', cashReceived: 9999 },
      });

      await expect(service.create(dto, USER_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(saleCreate).not.toHaveBeenCalled();
    });

    it('rechaza el descuento mayor al subtotal', async () => {
      const { service, productFindMany, saleCreate } = createMocks();

      productFindMany.mockResolvedValue([productRow()]);

      const dto = createSaleDto({
        items: [{ productId: PRODUCT_ID, quantity: 1 }],
        discountAmount: 10000.01,
      });

      await expect(service.create(dto, USER_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(saleCreate).not.toHaveBeenCalled();
    });

    it('rechaza la venta cuando el stock no alcanza', async () => {
      const { service, productFindMany, saleCreate, productUpdateMany } =
        createMocks();

      productFindMany.mockResolvedValue([productRow({ stock: 1 })]);

      const dto = createSaleDto({
        items: [{ productId: PRODUCT_ID, quantity: 2 }],
        payment: { method: 'CARD' },
      });

      await expect(service.create(dto, USER_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(saleCreate).not.toHaveBeenCalled();
      expect(productUpdateMany).not.toHaveBeenCalled();
    });

    it('rechaza productos inactivos o eliminados y responde 404 si no existe', async () => {
      const inactive = createMocks();

      inactive.productFindMany.mockResolvedValue([
        productRow({ active: false }),
      ]);

      await expect(
        inactive.service.create(
          createSaleDto({
            items: [{ productId: PRODUCT_ID, quantity: 1 }],
            payment: { method: 'CARD' },
          }),
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(inactive.saleCreate).not.toHaveBeenCalled();

      const removed = createMocks();

      removed.productFindMany.mockResolvedValue([
        productRow({ deletedAt: TIMESTAMP }),
      ]);

      await expect(
        removed.service.create(
          createSaleDto({
            items: [{ productId: PRODUCT_ID, quantity: 1 }],
            payment: { method: 'CARD' },
          }),
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      const missing = createMocks();

      missing.productFindMany.mockResolvedValue([]);

      await expect(
        missing.service.create(
          createSaleDto({
            items: [{ productId: PRODUCT_ID, quantity: 1 }],
            payment: { method: 'CARD' },
          }),
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(missing.saleCreate).not.toHaveBeenCalled();
    });
  });

  describe('voidSale', () => {
    it('anula la venta, restaura el stock y crea los movimientos VOID', async () => {
      const {
        service,
        saleFindUnique,
        saleUpdateMany,
        productFindUnique,
        productUpdate,
        movementCreate,
      } = createMocks();

      saleFindUnique
        .mockResolvedValueOnce(saleDetailRecord())
        .mockResolvedValueOnce(
          saleDetailRecord({
            status: SaleStatus.VOIDED,
            voidedAt: TIMESTAMP,
            voidedById: USER_ID,
            voidReason: 'Error de digitación',
            voidedBy: {
              id: USER_ID,
              name: 'Administrador POS',
              email: 'admin@pos.local',
            },
          }),
        );
      saleUpdateMany.mockResolvedValue({ count: 1 });
      productFindUnique.mockImplementation(async (args) => ({
        id: args.where.id,
        stock: args.where.id === PRODUCT_ID ? 8 : 4,
      }));
      productUpdate.mockResolvedValue({ id: PRODUCT_ID });
      movementCreate.mockResolvedValue({ id: ITEM_ID });

      const result = await service.voidSale(
        SALE_ID,
        voidSaleDto('  Error de digitación  '),
        USER_ID,
      );

      expect(saleUpdateMany).toHaveBeenCalledWith({
        where: { id: SALE_ID, status: SaleStatus.COMPLETED },
        data: {
          status: SaleStatus.VOIDED,
          voidedAt: expect.any(Date),
          voidedById: USER_ID,
          voidReason: 'Error de digitación',
        },
      });

      expect(productUpdate.mock.calls.map((call) => call[0])).toEqual([
        { where: { id: PRODUCT_ID }, data: { stock: { increment: 2 } } },
        { where: { id: SECOND_PRODUCT_ID }, data: { stock: { increment: 1 } } },
      ]);

      const movements = movementCreate.mock.calls.map(
        (call) => call[0].data as MovementCreateData,
      );

      expect(movements).toEqual([
        {
          productId: PRODUCT_ID,
          type: StockMovementType.VOID,
          quantity: 2,
          previousStock: 8,
          newStock: 10,
          unitCost: expect.anything(),
          reason: 'Error de digitación',
          saleId: SALE_ID,
          userId: USER_ID,
        },
        {
          productId: SECOND_PRODUCT_ID,
          type: StockMovementType.VOID,
          quantity: 1,
          previousStock: 4,
          newStock: 5,
          unitCost: expect.anything(),
          reason: 'Error de digitación',
          saleId: SALE_ID,
          userId: USER_ID,
        },
      ]);
      expect(movements.every((movement) => movement.quantity > 0)).toBe(true);

      expect(result).toMatchObject({
        status: SaleStatus.VOIDED,
        voidReason: 'Error de digitación',
      });
      expect(result.voidedBy).toEqual({
        id: USER_ID,
        name: 'Administrador POS',
        email: 'admin@pos.local',
      });
    });

    it('responde 409 cuando la venta ya está anulada', async () => {
      const {
        service,
        saleFindUnique,
        saleUpdateMany,
        productUpdate,
        movementCreate,
      } = createMocks();

      saleFindUnique.mockResolvedValue(
        saleDetailRecord({
          status: SaleStatus.VOIDED,
          voidedAt: TIMESTAMP,
          voidReason: 'Error de digitación',
        }),
      );

      await expect(
        service.voidSale(SALE_ID, voidSaleDto(), USER_ID),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(saleUpdateMany).not.toHaveBeenCalled();
      expect(productUpdate).not.toHaveBeenCalled();
      expect(movementCreate).not.toHaveBeenCalled();
    });

    it('responde 409 si otra transacción anuló la venta primero', async () => {
      const { service, saleFindUnique, saleUpdateMany, movementCreate } =
        createMocks();

      saleFindUnique.mockResolvedValue(saleDetailRecord());
      saleUpdateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.voidSale(SALE_ID, voidSaleDto(), USER_ID),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(movementCreate).not.toHaveBeenCalled();
    });

    it('responde 404 cuando la venta no existe', async () => {
      const { service, saleFindUnique, saleUpdateMany } = createMocks();

      saleFindUnique.mockResolvedValue(null);

      await expect(
        service.voidSale(SALE_ID, voidSaleDto(), USER_ID),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(saleUpdateMany).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('filtra por estado y rango de fechas con paginación', async () => {
      const { service, saleCount, saleFindMany } = createMocks();

      saleCount.mockResolvedValue(1);
      saleFindMany.mockResolvedValue([saleSummaryRecord()]);

      const result = await service.list({
        page: 2,
        pageSize: 1,
        status: 'COMPLETED',
        from: '2026-02-01T00:00:00.000Z',
        to: '2026-02-28T23:59:59.999Z',
      } as QuerySalesDto);

      const args = saleFindMany.mock.calls[0]?.[0];

      expect(args?.where).toMatchObject({
        status: SaleStatus.COMPLETED,
        createdAt: {
          gte: new Date('2026-02-01T00:00:00.000Z'),
          lte: new Date('2026-02-28T23:59:59.999Z'),
        },
      });
      expect(args?.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
      expect(args?.skip).toBe(1);
      expect(args?.take).toBe(1);
      expect(result.meta).toEqual({
        page: 2,
        pageSize: 1,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: true,
      });
      expect(result.data[0]).toMatchObject({
        number: 'V-000001',
        status: SaleStatus.COMPLETED,
        total: 32130,
        itemCount: 2,
        paymentMethod: PaymentMethod.CASH,
        voidedAt: null,
      });
      expect(result.data[0]?.user).toEqual({
        id: USER_ID,
        name: 'Administrador POS',
        email: 'admin@pos.local',
      });
    });

    it('rechaza una fecha de filtro inválida', async () => {
      const { service, saleFindMany } = createMocks();

      await expect(
        service.list({ page: 1, pageSize: 20, from: 'ayer' } as QuerySalesDto),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(saleFindMany).not.toHaveBeenCalled();
    });
  });

  describe('findOne y receipt', () => {
    it('devuelve el detalle completo de la venta', async () => {
      const { service, saleFindUnique } = createMocks();

      saleFindUnique.mockResolvedValue(saleDetailRecord());

      const detail = await service.findOne(SALE_ID);

      expect(detail).toMatchObject({
        id: SALE_ID,
        number: 'V-000001',
        itemCount: 2,
        costTotal: 24000,
        profit: 3000,
        voidedBy: null,
      });
      expect(detail.items[0]).toMatchObject({
        sku: 'BEB-001',
        quantity: 2,
        lineTotal: 18000,
      });

      const receipt = await service.receipt(SALE_ID);

      expect(receipt).toEqual(detail);
    });

    it('responde 404 cuando la venta no existe', async () => {
      const { service, saleFindUnique } = createMocks();

      saleFindUnique.mockResolvedValue(null);

      await expect(service.findOne(SALE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.receipt(SALE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
