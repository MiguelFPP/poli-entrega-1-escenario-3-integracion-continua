'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiFetch } from './api-client';
import { priceHistoryKeys, productKeys } from './catalog';
import type { Paginated, PaginationMeta, ProductCategoryRef } from './catalog';

export type { PaginationMeta };

/** Resumen agregado del inventario. */
export interface InventorySummary {
  readonly totalProducts: number;
  readonly totalUnits: number;
  readonly inventoryValue: number;
  readonly lowStockCount: number;
  readonly outOfStockCount: number;
  readonly generatedAt: string;
}

/** Tipo de movimiento de stock. */
export type MovementType = 'ENTRY' | 'SALE' | 'ADJUSTMENT' | 'VOID';

/** Producto embebido en un movimiento. */
export interface MovementProductRef {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
}

/** Usuario que registró un movimiento. */
export interface MovementUserRef {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

/** Movimiento de inventario. */
export interface StockMovement {
  readonly id: string;
  readonly productId: string;
  readonly product: MovementProductRef;
  readonly type: MovementType;
  readonly quantity: number;
  readonly previousStock: number;
  readonly newStock: number;
  readonly unitCost: number;
  readonly reason: string | null;
  readonly saleId: string | null;
  readonly user: MovementUserRef | null;
  readonly createdAt: string;
}

/** Producto por debajo de su stock mínimo. */
export interface LowStockItem {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly category: ProductCategoryRef;
  readonly stock: number;
  readonly minStock: number;
  readonly unit: string;
  readonly deficit: number;
  readonly costPrice: number;
  readonly inventoryValue: number;
  readonly lowStock: boolean;
}

/** Filtros y paginación del historial de movimientos. */
export interface MovementQuery {
  readonly page?: number;
  readonly pageSize?: number;
  readonly productId?: string;
  readonly type?: MovementType;
  readonly from?: string;
  readonly to?: string;
}

/** Filtros y paginación del listado de stock bajo. */
export interface LowStockQuery {
  readonly page?: number;
  readonly pageSize?: number;
  readonly categoryId?: string;
  readonly search?: string;
}

/** Cuerpo de alta de un movimiento manual. */
export interface MovementPayload {
  readonly productId: string;
  readonly type: 'ENTRY' | 'ADJUSTMENT';
  readonly quantity: number;
  readonly unitCost?: number;
  readonly reason?: string;
}

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  ENTRY: 'Entrada',
  SALE: 'Venta',
  ADJUSTMENT: 'Ajuste',
  VOID: 'Anulación',
};

/** La API rechaza los parámetros desconocidos: solo se envía lo que hay. */
function isPresent(value: string | undefined): value is string {
  return value !== undefined && value !== '';
}

/** Serializa los filtros de movimientos; `from` y `to` llegan ya en ISO. */
export function buildMovementQuery(query: MovementQuery): string {
  const parts: string[] = [];

  if (query.page !== undefined) {
    parts.push(`page=${query.page}`);
  }
  if (query.pageSize !== undefined) {
    parts.push(`pageSize=${query.pageSize}`);
  }
  if (isPresent(query.productId)) {
    parts.push(`productId=${encodeURIComponent(query.productId)}`);
  }
  if (query.type) {
    parts.push(`type=${query.type}`);
  }
  if (isPresent(query.from)) {
    parts.push(`from=${encodeURIComponent(query.from)}`);
  }
  if (isPresent(query.to)) {
    parts.push(`to=${encodeURIComponent(query.to)}`);
  }

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/** Serializa los filtros de stock bajo; omite los vacíos. */
export function buildLowStockQuery(query: LowStockQuery): string {
  const parts: string[] = [];

  if (query.page !== undefined) {
    parts.push(`page=${query.page}`);
  }
  if (query.pageSize !== undefined) {
    parts.push(`pageSize=${query.pageSize}`);
  }
  if (isPresent(query.categoryId)) {
    parts.push(`categoryId=${encodeURIComponent(query.categoryId)}`);
  }
  if (isPresent(query.search)) {
    parts.push(`search=${encodeURIComponent(query.search)}`);
  }

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/** Claves de consulta del inventario, para invalidar y preobtener. */
export const inventoryKeys = {
  all: ['inventory'] as const,
  summary: ['inventory', 'summary'] as const,
  movements: (query: MovementQuery) =>
    ['inventory', 'movements', query] as const,
  lowStock: (query: LowStockQuery) => ['inventory', 'low-stock', query] as const,
};

/** Resumen del inventario: unidades, valorización y alertas de stock. */
export function useInventorySummary() {
  return useQuery({
    queryKey: inventoryKeys.summary,
    queryFn: () => apiFetch<InventorySummary>('/inventory/summary'),
    staleTime: 30_000,
  });
}

/** Historial paginado de movimientos de stock. */
export function useMovements(query: MovementQuery) {
  return useQuery({
    queryKey: inventoryKeys.movements(query),
    queryFn: () =>
      apiFetch<Paginated<StockMovement>>(
        `/inventory/movements${buildMovementQuery(query)}`,
      ),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Productos con stock por debajo del mínimo, paginado. */
export function useLowStock(query: LowStockQuery) {
  return useQuery({
    queryKey: inventoryKeys.lowStock(query),
    queryFn: () =>
      apiFetch<Paginated<LowStockItem>>(
        `/inventory/low-stock${buildLowStockQuery(query)}`,
      ),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Registra una entrada o un ajuste; refresca inventario, catálogo y precios. */
export function useCreateMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MovementPayload) =>
      apiFetch<StockMovement>('/inventory/movements', {
        method: 'POST',
        json: payload,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
      void queryClient.invalidateQueries({ queryKey: priceHistoryKeys.all });
    },
  });
}
