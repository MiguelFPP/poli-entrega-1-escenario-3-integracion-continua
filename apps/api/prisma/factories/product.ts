import { faker } from '@faker-js/faker';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { ProductModel } from '../../src/generated/prisma/models.js';
import { createCategory } from './category.js';
import { factoryError } from './errors.js';
import { round2 } from './money.js';

export type ProductBuildInput = {
  sku?: string;
  barcode?: string | null;
  name?: string;
  description?: string | null;
  categoryId?: string;
  costPrice?: number;
  salePrice?: number;
  stock?: number;
  minStock?: number;
  unit?: string;
  imageUrl?: string | null;
  active?: boolean;
  deletedAt?: Date | null;
};

export type ProductBuildData = {
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  unit: string;
  imageUrl: string | null;
  active: boolean;
  deletedAt: Date | null;
};

/** Construye los datos de un producto sin tocar la base de datos. */
export function buildProduct(
  overrides: ProductBuildInput = {},
): ProductBuildData {
  const costPrice = round2(
    overrides.costPrice ?? faker.number.int({ min: 1_000, max: 80_000 }),
  );
  // Margen por defecto del 35 % sobre el costo, redondeado a la centena.
  const defaultSalePrice = Math.ceil((costPrice * 1.35) / 100) * 100;

  return {
    sku:
      overrides.sku ??
      `SKU-${faker.string.alphanumeric({ length: 8, casing: 'upper' })}`,
    barcode:
      overrides.barcode === undefined
        ? faker.string.numeric({ length: 13 })
        : overrides.barcode,
    name: overrides.name ?? faker.commerce.productName(),
    description: overrides.description ?? faker.commerce.productDescription(),
    categoryId: overrides.categoryId ?? faker.string.uuid(),
    costPrice,
    salePrice: round2(overrides.salePrice ?? defaultSalePrice),
    stock: overrides.stock ?? faker.number.int({ min: 0, max: 200 }),
    minStock: overrides.minStock ?? faker.number.int({ min: 0, max: 10 }),
    unit: overrides.unit ?? 'unidad',
    imageUrl: overrides.imageUrl ?? null,
    active: overrides.active ?? true,
    deletedAt: overrides.deletedAt ?? null,
  };
}

export async function createProduct(
  client: PrismaClient,
  overrides: ProductBuildInput = {},
): Promise<ProductModel> {
  try {
    const categoryId =
      overrides.categoryId ?? (await createCategory(client)).id;
    return await client.product.create({
      data: buildProduct({ ...overrides, categoryId }),
    });
  } catch (error) {
    throw factoryError('createProduct', error);
  }
}
