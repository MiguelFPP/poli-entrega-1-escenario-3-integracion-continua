import type {
  PriceHistoryGetPayload,
  PriceHistorySelect,
  ProductGetPayload,
  ProductInclude,
} from '../../generated/prisma/models.js';
import type { PriceHistoryResponseDto } from './dto/price-history-response.dto.js';
import type { ProductResponseDto } from './dto/product-response.dto.js';

/** Incluye la categoría (resumen) en toda lectura de producto. */
export const PRODUCT_INCLUDE = {
  category: { select: { id: true, name: true } },
} as const satisfies ProductInclude;

export type ProductWithCategory = ProductGetPayload<{
  include: typeof PRODUCT_INCLUDE;
}>;

export const PRICE_HISTORY_SELECT = {
  id: true,
  productId: true,
  field: true,
  oldValue: true,
  newValue: true,
  createdAt: true,
  changedBy: { select: { id: true, name: true, email: true } },
} as const satisfies PriceHistorySelect;

export type PriceHistoryWithUser = PriceHistoryGetPayload<{
  select: typeof PRICE_HISTORY_SELECT;
}>;

export function toProductResponseDto(
  product: ProductWithCategory,
): ProductResponseDto {
  return {
    id: product.id,
    sku: product.sku,
    barcode: product.barcode,
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    category: { id: product.category.id, name: product.category.name },
    costPrice: product.costPrice.toNumber(),
    salePrice: product.salePrice.toNumber(),
    stock: product.stock,
    minStock: product.minStock,
    unit: product.unit,
    imageUrl: product.imageUrl,
    active: product.active,
    lowStock: product.stock <= product.minStock,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export function toPriceHistoryResponseDto(
  entry: PriceHistoryWithUser,
): PriceHistoryResponseDto {
  return {
    id: entry.id,
    productId: entry.productId,
    field: entry.field,
    oldValue: entry.oldValue.toNumber(),
    newValue: entry.newValue.toNumber(),
    changedBy: entry.changedBy
      ? {
          id: entry.changedBy.id,
          name: entry.changedBy.name,
          email: entry.changedBy.email,
        }
      : null,
    createdAt: entry.createdAt.toISOString(),
  };
}
