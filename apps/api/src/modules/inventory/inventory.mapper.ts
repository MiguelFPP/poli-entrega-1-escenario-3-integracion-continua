import { StockMovementType } from '../../generated/prisma/client.js';
import type {
  ProductGetPayload,
  ProductSelect,
  StockMovementGetPayload,
  StockMovementInclude,
} from '../../generated/prisma/models.js';
import type { PaginationMetaDto } from '../../common/dto/pagination-meta.dto.js';
import type { LowStockItemDto } from './dto/low-stock-item.dto.js';
import type { StockMovementTypeName } from './dto/query-product-movements.dto.js';
import type { StockMovementResponseDto } from './dto/stock-movement-response.dto.js';

/** Traduce el filtro de texto al enum de Prisma. */
export const MOVEMENT_TYPE_VALUES: Record<
  StockMovementTypeName,
  StockMovementType
> = {
  ENTRY: StockMovementType.ENTRY,
  SALE: StockMovementType.SALE,
  ADJUSTMENT: StockMovementType.ADJUSTMENT,
  VOID: StockMovementType.VOID,
};

/** Producto y usuario (resumen) embebidos en todo movimiento de stock. */
export const STOCK_MOVEMENT_INCLUDE = {
  product: { select: { id: true, sku: true, name: true } },
  user: { select: { id: true, name: true, email: true } },
} as const satisfies StockMovementInclude;

export type StockMovementWithRelations = StockMovementGetPayload<{
  include: typeof STOCK_MOVEMENT_INCLUDE;
}>;

/** Datos mínimos para valorizar un producto crítico. */
export const LOW_STOCK_SELECT = {
  id: true,
  sku: true,
  name: true,
  stock: true,
  minStock: true,
  unit: true,
  costPrice: true,
  category: { select: { id: true, name: true } },
} as const satisfies ProductSelect;

export type LowStockProduct = ProductGetPayload<{
  select: typeof LOW_STOCK_SELECT;
}>;

// Replica `round2` de `prisma/factories/money.ts` (fuera del `rootDir` de `src`).
export function round2(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('Valor monetario inválido');
  }

  return (
    (Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100)) /
    100
  );
}

/** Convierte un importe a centavos para comparar sin errores de coma flotante. */
export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function toStockMovementResponseDto(
  movement: StockMovementWithRelations,
): StockMovementResponseDto {
  return {
    id: movement.id,
    productId: movement.productId,
    product: {
      id: movement.product.id,
      sku: movement.product.sku,
      name: movement.product.name,
    },
    type: movement.type,
    quantity: movement.quantity,
    previousStock: movement.previousStock,
    newStock: movement.newStock,
    unitCost: movement.unitCost.toNumber(),
    reason: movement.reason,
    saleId: movement.saleId,
    user: movement.user
      ? {
          id: movement.user.id,
          name: movement.user.name,
          email: movement.user.email,
        }
      : null,
    createdAt: movement.createdAt.toISOString(),
  };
}

export function toLowStockItemDto(product: LowStockProduct): LowStockItemDto {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: { id: product.category.id, name: product.category.name },
    stock: product.stock,
    minStock: product.minStock,
    unit: product.unit,
    deficit: Math.max(0, product.minStock - product.stock),
    costPrice: product.costPrice.toNumber(),
    inventoryValue: round2(product.stock * product.costPrice.toNumber()),
    lowStock: true,
  };
}

/** Metadatos de paginación comunes: `totalPages` es `0` cuando no hay filas. */
export function buildPaginationMeta(
  page: number,
  pageSize: number,
  total: number,
): PaginationMetaDto {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: total > 0 && page > 1,
  };
}
