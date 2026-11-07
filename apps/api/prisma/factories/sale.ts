import { faker } from '@faker-js/faker';
import {
  PaymentMethod,
  SaleStatus,
  StockMovementType,
  type PrismaClient,
} from '../../src/generated/prisma/client.js';
import type {
  PaymentModel,
  SaleItemModel,
  SaleModel,
  StockMovementModel,
} from '../../src/generated/prisma/models.js';
import { createUser } from './user.js';
import { createProduct } from './product.js';
import { buildPayment } from './payment.js';
import { factoryError } from './errors.js';
import {
  assertNonNegative,
  distributeDiscount,
  round2,
  taxFromGross,
  toNumber,
  type Money,
} from './money.js';

/** Línea de venta expresada con datos del producto ya resueltos. */
export type SaleLineInput = {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number | string | { toString(): string };
  unitCost: number | string | { toString(): string };
  /** Descuento absoluto de la línea (opcional). */
  discount?: number;
};

export type SaleItemTotals = {
  lineSubtotal: Money;
  lineDiscount: Money;
  lineTax: Money;
  lineTotal: Money;
  lineCost: Money;
  lineProfit: Money;
};

export type SaleTotals = {
  subtotal: Money;
  discountAmount: Money;
  taxAmount: Money;
  total: Money;
  costTotal: Money;
  profit: Money;
};

export type SaleItemBuildData = SaleItemTotals & {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
};

function assertPositiveInteger(label: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `[factories] ${label} debe ser un entero > 0 (recibido: ${value})`,
    );
  }
}

/** Calcula los totales de una línea con IVA incluido y descuento aplicado. */
export function computeItemTotals(line: SaleLineInput): SaleItemTotals {
  assertPositiveInteger('saleItem.quantity', line.quantity);

  const unitPrice = round2(toNumber(line.unitPrice));
  const unitCost = round2(toNumber(line.unitCost));
  assertNonNegative('saleItem.unitPrice', unitPrice);
  assertNonNegative('saleItem.unitCost', unitCost);

  const lineSubtotal = round2(unitPrice * line.quantity);
  const lineDiscount = round2(line.discount ?? 0);
  assertNonNegative('saleItem.discount', lineDiscount);

  if (lineDiscount > lineSubtotal) {
    throw new Error(
      `[factories] saleItem.discount (${lineDiscount}) no puede superar el subtotal (${lineSubtotal})`,
    );
  }

  const lineTotal = round2(lineSubtotal - lineDiscount);
  const lineTax = taxFromGross(lineTotal);
  const lineCost = round2(unitCost * line.quantity);
  const lineProfit = round2(lineTotal - lineTax - lineCost);

  return {
    lineSubtotal,
    lineDiscount,
    lineTax,
    lineTotal,
    lineCost,
    lineProfit,
  };
}

/** Agrega los totales de todas las líneas de una venta. */
export function computeSaleTotals(lines: readonly SaleLineInput[]): SaleTotals {
  const totals = lines.reduce<SaleTotals>(
    (acc, line) => {
      const item = computeItemTotals(line);
      return {
        subtotal: round2(acc.subtotal + item.lineSubtotal),
        discountAmount: round2(acc.discountAmount + item.lineDiscount),
        taxAmount: round2(acc.taxAmount + item.lineTax),
        total: round2(acc.total + item.lineTotal),
        costTotal: round2(acc.costTotal + item.lineCost),
        profit: round2(acc.profit + item.lineProfit),
      };
    },
    {
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      total: 0,
      costTotal: 0,
      profit: 0,
    },
  );

  return totals;
}

/** Convierte una línea en los datos listos para `saleItem.create`. */
export type SaleItemCreateData = Omit<SaleItemBuildData, 'lineCost'>;

/** `lineCost` no se persiste: el costo vive en `unitCost` × `quantity`. */
function toSaleItemCreate(item: SaleItemBuildData): SaleItemCreateData {
  return {
    productId: item.productId,
    productName: item.productName,
    sku: item.sku,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    unitCost: item.unitCost,
    lineSubtotal: item.lineSubtotal,
    lineDiscount: item.lineDiscount,
    lineTax: item.lineTax,
    lineTotal: item.lineTotal,
    lineProfit: item.lineProfit,
  };
}

/** Convierte una línea en los datos listos para `saleItem.create`. */
export function buildSaleItem(line: SaleLineInput): SaleItemBuildData {
  return {
    productId: line.productId,
    productName: line.productName,
    sku: line.sku,
    quantity: line.quantity,
    unitPrice: round2(toNumber(line.unitPrice)),
    unitCost: round2(toNumber(line.unitCost)),
    ...computeItemTotals(line),
  };
}

/** Aplica un `discountRate` global (prorrateado) o los descuentos por línea. */
function withResolvedDiscounts(
  lines: readonly SaleLineInput[],
  discountRate: number,
): SaleLineInput[] {
  const hasExplicitDiscount = lines.some((line) => line.discount !== undefined);
  if (hasExplicitDiscount) {
    return lines.map((line) => ({
      ...line,
      discount: round2(line.discount ?? 0),
    }));
  }

  const grossValues = lines.map((line) =>
    round2(toNumber(line.unitPrice) * line.quantity),
  );
  const discounts = distributeDiscount(grossValues, discountRate);

  return lines.map((line, index) => ({
    ...line,
    discount: discounts[index] ?? 0,
  }));
}

export type SaleBuildInput = {
  number?: bigint;
  status?: SaleStatus;
  userId?: string;
  items?: readonly SaleLineInput[];
  /** Descuento global 0..1, prorrateado entre líneas. */
  discountRate?: number;
  createdAt?: Date;
  voidedAt?: Date | null;
  voidedById?: string | null;
  voidReason?: string | null;
};

export type SaleBuildData = SaleTotals & {
  number: bigint;
  status: SaleStatus;
  userId: string;
  createdAt: Date;
  voidedAt: Date | null;
  voidedById: string | null;
  voidReason: string | null;
  items: SaleItemBuildData[];
};

/** Construye los datos de una venta (con sus líneas) sin tocar la base de datos. */
export function buildSale(overrides: SaleBuildInput = {}): SaleBuildData {
  const lines = withResolvedDiscounts(
    overrides.items ?? [],
    overrides.discountRate ?? 0,
  );
  const totals = computeSaleTotals(lines);
  const status = overrides.status ?? SaleStatus.COMPLETED;

  return {
    number:
      overrides.number ?? BigInt(faker.number.int({ min: 1, max: 1_000_000 })),
    status,
    userId: overrides.userId ?? faker.string.uuid(),
    createdAt: overrides.createdAt ?? new Date(),
    voidedAt:
      overrides.voidedAt ?? (status === SaleStatus.VOIDED ? new Date() : null),
    voidedById: overrides.voidedById ?? null,
    voidReason: overrides.voidReason ?? null,
    ...totals,
    items: lines.map(buildSaleItem),
  };
}

/** Consume el siguiente número de venta de `sale_number_seq`. */
export async function nextSaleNumber(client: {
  $queryRaw: PrismaClient['$queryRaw'];
}): Promise<bigint> {
  const rows = await client.$queryRaw<Array<{ value: bigint | string }>>`
    SELECT nextval('sale_number_seq') AS value
  `;
  const raw = rows[0]?.value;

  if (raw === undefined) {
    throw new Error(
      '[factories] no se pudo obtener el siguiente número de venta',
    );
  }

  return typeof raw === 'bigint' ? raw : BigInt(raw);
}

export type CreateSaleOptions = {
  /** Usuario que registra la venta; si omite se crea uno. */
  userId?: string;
  /** Líneas de la venta; si se omite se crean productos aleatorios. */
  items?: readonly SaleLineInput[];
  discountRate?: number;
  paymentMethod?: PaymentMethod;
  /** Efectivo recibido (solo pagos CASH). */
  cashReceived?: number;
  createdAt?: Date;
  /** Descuenta stock y crea movimientos `SALE`. */
  withStockMovements?: boolean;
  /** Anula la venta: restaura stock y registra movimientos `VOID`. */
  voided?: boolean;
  voidReason?: string;
  voidedById?: string;
  number?: bigint;
};

export type CreatedSale = {
  sale: SaleModel;
  items: SaleItemModel[];
  payment: PaymentModel;
  movements: StockMovementModel[];
};

async function buildDefaultLines(
  client: PrismaClient,
): Promise<SaleLineInput[]> {
  const count = faker.number.int({ min: 1, max: 2 });
  const lines: SaleLineInput[] = [];

  for (let index = 0; index < count; index += 1) {
    const product = await createProduct(client, { stock: 100 });
    lines.push({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: faker.number.int({ min: 1, max: 3 }),
      unitPrice: product.salePrice,
      unitCost: product.costPrice,
    });
  }

  return lines;
}

/** Crea una venta con ítems, pago y (opcionalmente) movimientos de stock. */
export async function createSale(
  client: PrismaClient,
  options: CreateSaleOptions = {},
): Promise<CreatedSale> {
  const withStockMovements =
    options.withStockMovements ?? options.voided ?? false;
  const createdAt = options.createdAt ?? new Date();
  const paymentMethod =
    options.paymentMethod ??
    faker.helpers.arrayElement([PaymentMethod.CASH, PaymentMethod.CARD]);

  try {
    const userId = options.userId ?? (await createUser(client)).id;
    const lines = withResolvedDiscounts(
      options.items ?? (await buildDefaultLines(client)),
      options.discountRate ?? 0,
    );

    if (lines.length === 0) {
      throw new Error('la venta debe tener al menos una línea');
    }

    // Valida existencia y stock antes de abrir la transacción.
    const products = await client.product.findMany({
      where: { id: { in: [...new Set(lines.map((line) => line.productId))] } },
    });
    const productsById = new Map(
      products.map((product) => [product.id, product]),
    );

    for (const line of lines) {
      const product = productsById.get(line.productId);
      if (!product) {
        throw new Error(`el producto ${line.productId} no existe`);
      }
      if (withStockMovements && product.stock < line.quantity) {
        throw new Error(
          `stock insuficiente para ${product.sku}: disponible ${product.stock}, solicitado ${line.quantity}`,
        );
      }
    }

    const saleData = buildSale({
      number: options.number ?? (await nextSaleNumber(client)),
      userId,
      items: lines,
      createdAt,
    });
    const payments = buildPayment({
      method: paymentMethod,
      amount: saleData.total,
      cashReceived: options.cashReceived ?? null,
    });

    return await client.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          number: saleData.number,
          status: saleData.status,
          userId: saleData.userId,
          subtotal: saleData.subtotal,
          discountAmount: saleData.discountAmount,
          taxAmount: saleData.taxAmount,
          total: saleData.total,
          costTotal: saleData.costTotal,
          profit: saleData.profit,
          createdAt: saleData.createdAt,
          items: { create: saleData.items.map(toSaleItemCreate) },
        },
        include: { items: true },
      });

      const payment = await tx.payment.create({
        data: { saleId: sale.id, ...payments },
      });

      const movements: StockMovementModel[] = [];

      if (withStockMovements) {
        for (const item of sale.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });
          if (!product) {
            throw new Error(
              `el producto ${item.productId} desapareció durante la venta`,
            );
          }

          const newStock = product.stock - item.quantity;
          if (newStock < 0) {
            throw new Error(
              `stock insuficiente para ${product.sku}: disponible ${product.stock}, solicitado ${item.quantity}`,
            );
          }

          await tx.product.update({
            where: { id: product.id },
            data: { stock: newStock },
          });
          movements.push(
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                type: StockMovementType.SALE,
                quantity: -item.quantity,
                previousStock: product.stock,
                newStock,
                unitCost: item.unitCost,
                saleId: sale.id,
                userId,
                createdAt,
              },
            }),
          );
        }
      }

      let finalSale: SaleModel = sale;

      if (options.voided) {
        const voidedAt = new Date(createdAt.getTime() + 60_000);
        finalSale = await tx.sale.update({
          where: { id: sale.id },
          data: {
            status: SaleStatus.VOIDED,
            voidedAt,
            voidedById: options.voidedById ?? userId,
            voidReason: options.voidReason ?? 'Anulación de prueba',
          },
        });

        // Anular una venta sin movimientos no afecta el stock.
        if (withStockMovements) {
          for (const item of sale.items) {
            const product = await tx.product.findUnique({
              where: { id: item.productId },
            });
            if (!product) {
              throw new Error(
                `el producto ${item.productId} desapareció durante la anulación`,
              );
            }

            const newStock = product.stock + item.quantity;
            await tx.product.update({
              where: { id: product.id },
              data: { stock: newStock },
            });
            movements.push(
              await tx.stockMovement.create({
                data: {
                  productId: item.productId,
                  type: StockMovementType.VOID,
                  quantity: item.quantity,
                  previousStock: product.stock,
                  newStock,
                  unitCost: item.unitCost,
                  reason: finalSale.voidReason,
                  saleId: sale.id,
                  userId,
                  createdAt: voidedAt,
                },
              }),
            );
          }
        }
      }

      return { sale: finalSale, items: sale.items, payment, movements };
    });
  } catch (error) {
    throw factoryError('createSale', error);
  }
}
