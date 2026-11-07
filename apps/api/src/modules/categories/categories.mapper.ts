import type {
  CategoryGetPayload,
  CategorySelect,
} from '../../generated/prisma/models.js';
import type { CategoryResponseDto } from './dto/category-response.dto.js';

/**
 * Proyección pública de una categoría. `productCount` cuenta solo productos
 * no eliminados lógicamente, para que el número refleje el catálogo vigente.
 */
export const CATEGORY_WITH_COUNT_SELECT = {
  id: true,
  name: true,
  description: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: { products: { where: { deletedAt: null } } },
  },
} as const satisfies CategorySelect;

export type CategoryWithCount = CategoryGetPayload<{
  select: typeof CATEGORY_WITH_COUNT_SELECT;
}>;

export function toCategoryResponseDto(
  category: CategoryWithCount,
): CategoryResponseDto {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    active: category.active,
    productCount: category._count.products,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}
