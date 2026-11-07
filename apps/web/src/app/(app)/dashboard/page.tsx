'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DashboardLowStock } from '@/components/dashboard/dashboard-low-stock';
import { DateRangePicker } from '@/components/dashboard/date-range';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { PaymentMethods } from '@/components/dashboard/payment-methods';
import { SalesChart } from '@/components/dashboard/sales-chart';
import { TopProducts } from '@/components/dashboard/top-products';
import { Button, Icon, Select, Skeleton } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { extractErrorMessage } from '@/lib/api-client';
import {
  TREND_GRANULARITY_LABELS,
  percentChange,
  previousRange,
  resolvePreset,
  useDashboardLowStock,
  useDashboardSummary,
  usePaymentMethods,
  useSalesTrend,
  useTopProducts,
} from '@/lib/dashboard';
import type {
  DateRange,
  RangePreset,
  TopProductSort,
  TrendGranularity,
} from '@/lib/dashboard';
import { formatCurrency } from '@/lib/format';

const TOP_PRODUCTS_LIMIT = 10;
const LOW_STOCK_LIMIT = 10;
const SKELETON_KPIS = 9;

const PERCENT_FORMATTER = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 2,
});

const GRANULARITIES: readonly TrendGranularity[] = ['day', 'week', 'month'];

const GRANULARITY_OPTIONS: readonly SelectOption[] = GRANULARITIES.map(
  (value) => ({ value, label: TREND_GRANULARITY_LABELS[value] }),
);

export default function DashboardPage(): ReactNode {
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [range, setRange] = useState<DateRange>(() => resolvePreset('30d'));
  const [granularity, setGranularity] = useState<TrendGranularity>('day');
  const [topSort, setTopSort] = useState<TopProductSort>('quantity');

  const comparisonRange = useMemo(() => previousRange(range), [range]);

  const summaryQuery = useDashboardSummary(range);
  const previousQuery = useDashboardSummary(comparisonRange);
  const trendQuery = useSalesTrend(range, granularity);
  const topProductsQuery = useTopProducts(range, topSort, TOP_PRODUCTS_LIMIT);
  const paymentMethodsQuery = usePaymentMethods(range);
  const lowStockQuery = useDashboardLowStock(LOW_STOCK_LIMIT);

  const handleRangeChange = (next: {
    readonly preset: RangePreset;
    readonly range: DateRange;
  }): void => {
    setPreset(next.preset);
    setRange(next.range);
  };

  const handleGranularityChange = (value: string): void => {
    const next = GRANULARITIES.find((candidate) => candidate === value);
    if (next) {
      setGranularity(next);
    }
  };

  const summary = summaryQuery.data;
  const previous = previousQuery.data;
  const salesDelta =
    summary && previous
      ? percentChange(summary.totalSales, previous.totalSales)
      : null;
  const profitDelta =
    summary && previous
      ? percentChange(summary.grossProfit, previous.grossProfit)
      : null;
  const ticketDelta =
    summary && previous
      ? percentChange(summary.averageTicket, previous.averageTicket)
      : null;

  const renderKpis = (): ReactNode => {
    if (summaryQuery.isError) {
      return (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-3xl border border-error bg-surface-container-low p-6"
        >
          <h2 className="text-base font-semibold text-on-surface">
            No se pudo cargar el dashboard
          </h2>
          <p className="text-sm text-on-surface-variant">
            {extractErrorMessage(summaryQuery.error)}
          </p>
          <Button
            variant="outlined"
            onClick={() => {
              void summaryQuery.refetch();
            }}
          >
            Reintentar
          </Button>
        </div>
      );
    }

    if (summaryQuery.isLoading || !summary) {
      return (
        <div
          role="status"
          aria-label="Cargando indicadores"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {Array.from({ length: SKELETON_KPIS }, (_, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-3xl bg-surface-container-low p-6"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-32" />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Ventas"
          value={formatCurrency(summary.totalSales)}
          helper="IVA incluido y descuentos ya aplicados."
          delta={salesDelta}
          icon={<Icon name="sales" />}
        />
        <KpiCard
          label="Ganancia bruta"
          value={formatCurrency(summary.grossProfit)}
          helper="Ganancia = ventas sin IVA - costo."
          delta={profitDelta}
        />
        <KpiCard
          label="Margen"
          value={`${PERCENT_FORMATTER.format(summary.margin)}%`}
          helper="Margen = ganancia / ventas sin IVA."
        />
        <KpiCard
          label="Ticket promedio"
          value={formatCurrency(summary.averageTicket)}
          helper="Ticket promedio = ventas / transacciones."
          delta={ticketDelta}
        />
        <KpiCard
          label="Transacciones"
          value={String(summary.transactionCount)}
          helper="Ventas completadas del periodo."
        />
        <KpiCard
          label="Descuentos"
          value={formatCurrency(summary.discounts)}
          helper="Descuentos otorgados en el periodo."
        />
        <KpiCard
          label="Pérdidas"
          value={formatCurrency(summary.losses)}
          helper="Pérdidas = mermas + descuentos."
          icon={<Icon name="warning" />}
        />
        <KpiCard
          label="Valor inventario"
          value={formatCurrency(summary.inventoryValue)}
          helper="Inventario actual valorizado a costo."
          icon={<Icon name="inventory" />}
        />
        <KpiCard
          label="Stock bajo"
          value={String(summary.lowStockCount)}
          helper="Productos en o bajo su stock mínimo."
          icon={<Icon name="warning" />}
        />
      </div>
    );
  };

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-on-surface">Dashboard</h1>
          <p className="text-sm text-on-surface-variant">
            Indicadores de ventas, ganancia, inventario y cobros del periodo
            seleccionado.
          </p>
        </div>
        <DateRangePicker
          value={range}
          preset={preset}
          onChange={handleRangeChange}
        />
      </header>

      {renderKpis()}

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-on-surface">
            Tendencia de ventas
          </h2>
          <Select
            label="Agrupar por"
            options={GRANULARITY_OPTIONS}
            value={granularity}
            onValueChange={handleGranularityChange}
            className="w-full sm:w-44"
          />
        </div>
        <SalesChart
          data={trendQuery.data?.data ?? []}
          granularity={granularity}
          isLoading={trendQuery.isLoading}
          isError={trendQuery.isError}
          onRetry={() => {
            void trendQuery.refetch();
          }}
        />
      </section>

      <TopProducts
        data={topProductsQuery.data?.data ?? []}
        sortBy={topSort}
        onSortChange={setTopSort}
        isLoading={topProductsQuery.isLoading}
        isError={topProductsQuery.isError}
        onRetry={() => {
          void topProductsQuery.refetch();
        }}
      />

      <PaymentMethods
        data={paymentMethodsQuery.data?.data ?? []}
        total={
          paymentMethodsQuery.data?.total ?? { transactions: 0, amount: 0 }
        }
        isLoading={paymentMethodsQuery.isLoading}
      />

      <DashboardLowStock
        data={lowStockQuery.data?.data ?? []}
        isLoading={lowStockQuery.isLoading}
      />
    </section>
  );
}
