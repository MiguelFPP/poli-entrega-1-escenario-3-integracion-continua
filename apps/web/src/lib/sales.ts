'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ApiError, apiFetch } from './api-client';
import { productKeys } from './catalog';
import type { Paginated } from './catalog';

/** Estado de una venta. */
export type SaleStatus = 'COMPLETED' | 'VOIDED';

/** Método de pago admitido. */
export type PaymentMethodName = 'CASH' | 'CARD';

/** Usuario (resumen) asociado a una venta. */
export interface SaleUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

/** Línea de venta: snapshot del producto y sus totales. */
export interface SaleItem {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly sku: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly unitCost: number;
  readonly lineSubtotal: number;
  readonly lineDiscount: number;
  readonly lineTax: number;
  readonly lineTotal: number;
  readonly lineProfit: number;
}

/** Pago único de la venta. */
export interface SalePayment {
  readonly id: string;
  readonly method: PaymentMethodName;
  readonly amount: number;
  readonly cashReceived: number | null;
  readonly changeGiven: number | null;
  readonly createdAt: string;
}

/** Cabecera de venta usada por el listado. */
export interface SaleSummary {
  readonly id: string;
  readonly number: string;
  readonly status: SaleStatus;
  readonly total: number;
  readonly itemCount: number;
  readonly paymentMethod: PaymentMethodName | null;
  readonly createdAt: string;
  readonly voidedAt: string | null;
  readonly user: SaleUser;
}

/** Detalle de venta: cabecera, líneas, pago y datos de anulación. */
export interface SaleDetail extends SaleSummary {
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly taxAmount: number;
  readonly costTotal: number;
  readonly profit: number;
  readonly voidReason: string | null;
  readonly voidedBy: SaleUser | null;
  readonly items: SaleItem[];
  readonly payment: SalePayment | null;
}

/** Filtros y paginación del listado de ventas. */
export interface SaleQuery {
  readonly page?: number;
  readonly pageSize?: number;
  readonly status?: SaleStatus;
  readonly from?: string;
  readonly to?: string;
}

/** Línea del carrito que viaja a la API. */
export interface CreateSaleItem {
  readonly productId: string;
  readonly quantity: number;
}

/** Cuerpo de alta de una venta. */
export interface CreateSalePayload {
  readonly items: readonly CreateSaleItem[];
  readonly discountAmount?: number;
  readonly payment: {
    readonly method: PaymentMethodName;
    readonly cashReceived?: number;
  };
}

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  COMPLETED: 'Completada',
  VOIDED: 'Anulada',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodName, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
};

/** La API rechaza los parámetros desconocidos: solo se envía lo que hay. */
function isPresent(value: string | undefined): value is string {
  return value !== undefined && value !== '';
}

/** Serializa los filtros de ventas; `from` y `to` llegan ya en ISO. */
export function buildSaleQuery(query: SaleQuery): string {
  const parts: string[] = [];

  if (query.page !== undefined) {
    parts.push(`page=${query.page}`);
  }
  if (query.pageSize !== undefined) {
    parts.push(`pageSize=${query.pageSize}`);
  }
  if (query.status) {
    parts.push(`status=${query.status}`);
  }
  if (isPresent(query.from)) {
    parts.push(`from=${encodeURIComponent(query.from)}`);
  }
  if (isPresent(query.to)) {
    parts.push(`to=${encodeURIComponent(query.to)}`);
  }

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/** Claves de consulta de ventas, para invalidar y preobtener. */
export const saleKeys = {
  all: ['sales'] as const,
  list: (query: SaleQuery) => ['sales', 'list', query] as const,
  detail: (id: string) => ['sales', 'detail', id] as const,
};

/** Listado paginado de ventas, de la más reciente a la más antigua. */
export function useSales(query: SaleQuery) {
  return useQuery({
    queryKey: saleKeys.list(query),
    queryFn: () =>
      apiFetch<Paginated<SaleSummary>>(`/sales${buildSaleQuery(query)}`),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/**
 * Detalle de una venta; un 404 se resuelve como `null`.
 *
 * TanStack Query v5 no admite `undefined` como resultado de una consulta
 * (lanza "Query data cannot be undefined"), así que el "no existe" se
 * representa con `null`.
 */
export function useSale(id: string | undefined) {
  return useQuery({
    queryKey: saleKeys.detail(id ?? ''),
    queryFn: async (): Promise<SaleDetail | null> => {
      try {
        return await apiFetch<SaleDetail>(`/sales/${id}`);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

/** Registra una venta y refresca el historial y el stock del catálogo. */
export function useCreateSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateSalePayload) =>
      apiFetch<SaleDetail>('/sales', { method: 'POST', json: payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: saleKeys.all });
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}

export interface VoidSaleVariables {
  readonly id: string;
  readonly reason: string;
}

/** Anula una venta y refresca su detalle, el historial y el catálogo. */
export function useVoidSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: VoidSaleVariables) =>
      apiFetch<SaleDetail>(`/sales/${id}/void`, {
        method: 'POST',
        json: { reason },
      }),
    onSuccess: (_sale, variables) => {
      void queryClient.invalidateQueries({ queryKey: saleKeys.all });
      void queryClient.invalidateQueries({
        queryKey: saleKeys.detail(variables.id),
      });
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}
