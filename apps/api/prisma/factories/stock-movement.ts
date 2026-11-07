import { faker } from '@faker-js/faker';
import {
  StockMovementType,
  type PrismaClient,
} from '../../src/generated/prisma/client.js';
import type { StockMovementModel } from '../../src/generated/prisma/models.js';
import { factoryError } from './errors.js';
import { round2 } from './money.js';

export type StockMovementBuildInput = {
  productId?: string;
  type?: StockMovementType;
  quantity?: number;
  previousStock?: number;
  newStock?: number;
  unitCost?: number;
  reason?: string | null;
  saleId?: string | null;
  userId?: string | null;
  createdAt?: Date;
};

export type StockMovementBuildData = {
  productId: string;
  type: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  unitCost: number;
  reason: string | null;
  saleId: string | null;
  userId: string | null;
  createdAt: Date;
};

/** Construye los datos de un movimiento de stock sin tocar la base de datos. */
export function buildStockMovement(
  overrides: StockMovementBuildInput = {},
): StockMovementBuildData {
  const quantity = overrides.quantity ?? faker.number.int({ min: -5, max: 20 });
  const previousStock =
    overrides.previousStock ?? faker.number.int({ min: 0, max: 150 });

  return {
    productId: overrides.productId ?? faker.string.uuid(),
    type:
      overrides.type ??
      (quantity >= 0 ? StockMovementType.ENTRY : StockMovementType.ADJUSTMENT),
    quantity,
    previousStock,
    newStock: overrides.newStock ?? previousStock + quantity,
    unitCost: round2(
      overrides.unitCost ?? faker.number.int({ min: 1_000, max: 50_000 }),
    ),
    reason: overrides.reason ?? null,
    saleId: overrides.saleId ?? null,
    userId: overrides.userId ?? null,
    createdAt: overrides.createdAt ?? new Date(),
  };
}

export type CreateStockMovementOptions = {
  /** Producto (real) afectado. */
  productId: string;
  /** Cantidad firmada: positiva entra, negativa sale. */
  quantity: number;
  type?: StockMovementType;
  unitCost?: number;
  reason?: string | null;
  userId?: string | null;
  createdAt?: Date;
};

/** Registra un movimiento y aplica el cambio de stock en una transacción. */
export async function createStockMovement(
  client: PrismaClient,
  options: CreateStockMovementOptions,
): Promise<StockMovementModel> {
  const { productId, quantity, type, unitCost, reason, userId, createdAt } =
    options;

  try {
    return await client.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) {
        throw new Error(`el producto ${productId} no existe`);
      }

      const previousStock = product.stock;
      const newStock = previousStock + quantity;
      if (newStock < 0) {
        throw new Error(
          `stock insuficiente para ${product.sku}: ${previousStock} + ${quantity} < 0`,
        );
      }

      await tx.product.update({
        where: { id: productId },
        data: { stock: newStock },
      });

      return await tx.stockMovement.create({
        data: buildStockMovement({
          productId,
          type:
            type ??
            (quantity >= 0
              ? StockMovementType.ENTRY
              : StockMovementType.ADJUSTMENT),
          quantity,
          previousStock,
          newStock,
          unitCost: unitCost ?? Number(product.costPrice),
          reason,
          userId,
          createdAt,
        }),
      });
    });
  } catch (error) {
    throw factoryError('createStockMovement', error);
  }
}
