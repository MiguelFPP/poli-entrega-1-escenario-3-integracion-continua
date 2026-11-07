import { faker } from '@faker-js/faker';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { CategoryModel } from '../../src/generated/prisma/models.js';
import { factoryError } from './errors.js';

export type CategoryBuildInput = {
  name?: string;
  description?: string | null;
  active?: boolean;
};

export type CategoryBuildData = {
  name: string;
  description: string | null;
  active: boolean;
};

/** Construye los datos de una categoría sin tocar la base de datos. */
export function buildCategory(
  overrides: CategoryBuildInput = {},
): CategoryBuildData {
  const suffix = faker.string.alphanumeric({ length: 4, casing: 'upper' });

  return {
    name: overrides.name ?? `${faker.commerce.department()} ${suffix}`,
    description: overrides.description ?? faker.commerce.productDescription(),
    active: overrides.active ?? true,
  };
}

export async function createCategory(
  client: PrismaClient,
  overrides: CategoryBuildInput = {},
): Promise<CategoryModel> {
  try {
    return await client.category.create({ data: buildCategory(overrides) });
  } catch (error) {
    throw factoryError('createCategory', error);
  }
}
