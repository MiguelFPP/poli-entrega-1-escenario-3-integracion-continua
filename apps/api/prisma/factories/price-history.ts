import { faker } from '@faker-js/faker';
import {
  PriceField,
  type PrismaClient,
} from '../../src/generated/prisma/client.js';
import type { PriceHistoryModel } from '../../src/generated/prisma/models.js';
import { factoryError } from './errors.js';
import { round2 } from './money.js';

export type PriceHistoryBuildInput = {
  productId?: string;
  field?: PriceField;
  oldValue?: number;
  newValue?: number;
  changedById?: string | null;
  createdAt?: Date;
};

export type PriceHistoryBuildData = {
  productId: string;
  field: PriceField;
  oldValue: number;
  newValue: number;
  changedById: string | null;
  createdAt: Date;
};

/** Construye los datos de un cambio de precio sin tocar la base de datos. */
export function buildPriceHistory(
  overrides: PriceHistoryBuildInput = {},
): PriceHistoryBuildData {
  const oldValue = round2(
    overrides.oldValue ?? faker.number.int({ min: 1_000, max: 50_000 }),
  );

  return {
    productId: overrides.productId ?? faker.string.uuid(),
    field: overrides.field ?? PriceField.SALE,
    oldValue,
    newValue: round2(overrides.newValue ?? oldValue * 1.1),
    changedById: overrides.changedById ?? null,
    createdAt: overrides.createdAt ?? faker.date.recent({ days: 30 }),
  };
}

export type CreatePriceHistoryOptions = PriceHistoryBuildInput & {
  /** Producto real sobre el que se registra el cambio. */
  productId: string;
};

export async function createPriceHistory(
  client: PrismaClient,
  options: CreatePriceHistoryOptions,
): Promise<PriceHistoryModel> {
  try {
    return await client.priceHistory.create({
      data: buildPriceHistory(options),
    });
  } catch (error) {
    throw factoryError('createPriceHistory', error);
  }
}
