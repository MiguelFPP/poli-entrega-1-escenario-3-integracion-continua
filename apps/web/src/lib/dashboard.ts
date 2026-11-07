'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from './api-client';
import type { PaymentMethodName } from './sales';

/** Rango de fechas en ISO 8601 (UTC). */
export interface DateRange {
  readonly from: string;
  readonly to: string;
}

/** Atajos de rango que ofrece el dashboard. */
export type RangePreset = 'today' | '7d' | '30d' | 'month' | 'custom';

/** KPIs de ventas, pérdidas e inventario del rango consultado. */
export interface DashboardSummary {
  readonly range: DateRange;
  readonly totalSales: number;
  readonly grossSales: number;
  readonly netSales: number;
  readonly costOfSales: number;
  readonly grossProfit: number;
  readonly margin: number;
  readonly averageTicket: number;
  readonly transactionCount: number;
  readonly discounts: number;
  readonly shrinkage: number;
  readonly losses: number;
  readonly inventoryValue: number;
  readonly lowStockCount: number;
  readonly outOfStockCount: number;
}

/** Agrupación temporal de la tendencia. */
export type TrendGranularity = 'day' | 'week' | 'month';

/** Bucket de la tendencia con las ventas de un periodo. */
export interface SalesTrendPoint {
  readonly period: string;
  readonly totalSales: number;
  readonly netSales: number;
  readonly grossProfit: number;
  readonly transactions: number;
}

/** Serie temporal de ventas agrupada por `day`, `week` o `month`. */
export interface SalesTrend {
  readonly range: DateRange;
  readonly granularity: TrendGranularity;
  readonly data: SalesTrendPoint[];
}

/** Criterio de orden del top de productos. */
export type TopProductSort = 'quantity' | 'revenue' | 'profit';

/** Producto del top de ventas. */
export interface TopProduct {
  readonly productId: string;
  readonly name: string;
  readonly sku: string;
  readonly quantity: number;
  readonly revenue: number;
  readonly profit: number;
}

/** Top de productos vendidos en el rango. */
export interface TopProductsResponse {
  readonly range: DateRange;
  readonly sortBy: TopProductSort;
  readonly data: TopProduct[];
}

/** Cobros de un método de pago dentro del rango. */
export interface PaymentMethodStat {
  readonly method: PaymentMethodName;
  readonly transactions: number;
  readonly amount: number;
}

/** Distribución de los cobros por método de pago. */
export interface PaymentMethodsResponse {
  readonly range: DateRange;
  readonly data: PaymentMethodStat[];
  readonly total: { readonly transactions: number; readonly amount: number };
}

/** Producto activo en o por debajo de su stock mínimo. */
export interface DashboardLowStockItem {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly stock: number;
  readonly minStock: number;
  readonly deficit: number;
  readonly unit: string;
}

/** Alertas de reposición del dashboard. */
export interface DashboardLowStockResponse {
  readonly data: DashboardLowStockItem[];
}

/** Atajos de rango del dashboard, en el orden de los botones. */
export const DASHBOARD_PRESETS: readonly {
  readonly value: RangePreset;
  readonly label: string;
}[] = [
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: 'month', label: 'Este mes' },
  { value: 'custom', label: 'Personalizado' },
];

/** Etiquetas de la agrupación temporal. */
export const TREND_GRANULARITY_LABELS: Record<TrendGranularity, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
};

/** Etiquetas del criterio de orden del top de productos. */
export const TOP_PRODUCT_SORT_LABELS: Record<TopProductSort, string> = {
  quantity: 'Cantidad',
  revenue: 'Ingresos',
  profit: 'Ganancia',
};

/** Serializa el rango en los parámetros `from` y `to` de la API. */
export function buildDashboardQuery(range: DateRange): string {
  return `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
}

/** Claves de consulta del dashboard, para invalidar y preobtener. */
export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (range: DateRange) => ['dashboard', 'summary', range] as const,
  trend: (range: DateRange, granularity: TrendGranularity) =>
    ['dashboard', 'sales-trend', range, granularity] as const,
  topProducts: (range: DateRange, sortBy: TopProductSort, limit: number) =>
    ['dashboard', 'top-products', range, sortBy, limit] as const,
  paymentMethods: (range: DateRange) =>
    ['dashboard', 'payment-methods', range] as const,
  lowStock: (limit: number) => ['dashboard', 'low-stock', limit] as const,
};

const BOGOTA_TIME_ZONE = 'America/Bogota';
/** Bogotá es UTC-5 todo el año: no hay horario de verano que ajustar. */
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const BOGOTA_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: BOGOTA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Año, mes (1-12) y día del `date` en la zona `America/Bogota`. */
function bogotaDateParts(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  let year = 0;
  let month = 1;
  let day = 1;

  for (const part of BOGOTA_DATE_FORMATTER.formatToParts(date)) {
    if (part.type === 'year') {
      year = Number.parseInt(part.value, 10);
    } else if (part.type === 'month') {
      month = Number.parseInt(part.value, 10);
    } else if (part.type === 'day') {
      day = Number.parseInt(part.value, 10);
    }
  }

  return { year, month, day };
}

/** Instante UTC de la medianoche en Bogotá del día del `date`. */
function startOfBogotaDay(date: Date): Date {
  const { year, month, day } = bogotaDateParts(date);
  return new Date(Date.UTC(year, month - 1, day) + BOGOTA_OFFSET_MS);
}

/** Instante UTC de la medianoche en Bogotá del primer día del mes del `date`. */
function startOfBogotaMonth(date: Date): Date {
  const { year, month } = bogotaDateParts(date);
  return new Date(Date.UTC(year, month - 1, 1) + BOGOTA_OFFSET_MS);
}

function shiftDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/**
 * Rango ISO de un atajo: `today` arranca en la medianoche de Bogotá y todos
 * cierran en `now`. `custom` no define un rango propio y cae en el de 30 días.
 */
export function resolvePreset(
  preset: RangePreset,
  now: Date = new Date(),
): DateRange {
  const to = now.toISOString();
  const startOfToday = startOfBogotaDay(now);

  switch (preset) {
    case 'today':
      return { from: startOfToday.toISOString(), to };
    case '7d':
      return { from: shiftDays(startOfToday, -6).toISOString(), to };
    case 'month':
      return { from: startOfBogotaMonth(now).toISOString(), to };
    case '30d':
    case 'custom':
      return { from: shiftDays(startOfToday, -29).toISOString(), to };
  }
}

/** Rango inmediatamente anterior de la misma duración, para la variación. */
export function previousRange(range: DateRange): DateRange {
  const from = Date.parse(range.from);
  const to = Date.parse(range.to);

  if (Number.isNaN(from) || Number.isNaN(to) || to < from) {
    return range;
  }

  const previousTo = from - 1;
  const previousFrom = previousTo - (to - from);

  return {
    from: new Date(previousFrom).toISOString(),
    to: new Date(previousTo).toISOString(),
  };
}

/** Variación porcentual frente al periodo anterior; `null` si no hay base. */
export function percentChange(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

/** Resumen de KPIs del rango. */
export function useDashboardSummary(range: DateRange) {
  return useQuery({
    queryKey: dashboardKeys.summary(range),
    queryFn: () =>
      apiFetch<DashboardSummary>(
        `/dashboard/summary${buildDashboardQuery(range)}`,
      ),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Serie temporal de ventas del rango. */
export function useSalesTrend(range: DateRange, granularity: TrendGranularity) {
  return useQuery({
    queryKey: dashboardKeys.trend(range, granularity),
    queryFn: () =>
      apiFetch<SalesTrend>(
        `/dashboard/sales-trend${buildDashboardQuery(range)}&granularity=${granularity}`,
      ),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Top de productos vendidos del rango. */
export function useTopProducts(
  range: DateRange,
  sortBy: TopProductSort,
  limit: number,
) {
  return useQuery({
    queryKey: dashboardKeys.topProducts(range, sortBy, limit),
    queryFn: () =>
      apiFetch<TopProductsResponse>(
        `/dashboard/top-products${buildDashboardQuery(range)}&limit=${limit}&sortBy=${sortBy}`,
      ),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Distribución de los cobros por método de pago. */
export function usePaymentMethods(range: DateRange) {
  return useQuery({
    queryKey: dashboardKeys.paymentMethods(range),
    queryFn: () =>
      apiFetch<PaymentMethodsResponse>(
        `/dashboard/payment-methods${buildDashboardQuery(range)}`,
      ),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Alertas de reposición del dashboard. */
export function useDashboardLowStock(limit: number) {
  return useQuery({
    queryKey: dashboardKeys.lowStock(limit),
    queryFn: () =>
      apiFetch<DashboardLowStockResponse>(
        `/dashboard/low-stock?limit=${limit}`,
      ),
    staleTime: 30_000,
  });
}
