'use client';

import type { ReactNode } from 'react';
import { Button, EmptyState, Icon, Skeleton } from '@/components/ui';
import type { SalesTrendPoint, TrendGranularity } from '@/lib/dashboard';
import { formatCurrency } from '@/lib/format';

const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 260;
const PLOT_TOP = 8;
const PLOT_BOTTOM = 210;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
const LABEL_Y = 238;
const BAR_RATIO = 0.6;
const MIN_BAR_HEIGHT = 2;
const SKELETON_BARS = 8;

/** Periodo abreviado para el eje: `DD/MM` en día/semana y `YYYY-MM` en mes. */
export function formatTrendPeriod(
  period: string,
  granularity: TrendGranularity,
): string {
  if (granularity === 'month') {
    return period;
  }
  const [, month, day] = period.split('-');
  return month && day ? `${day}/${month}` : period;
}

/** Texto del tooltip nativo de una barra. */
export function trendBarTitle(
  point: SalesTrendPoint,
  granularity: TrendGranularity,
): string {
  const period = formatTrendPeriod(point.period, granularity);
  return `${period} · ${formatCurrency(point.totalSales)}`;
}

export interface SalesChartProps {
  readonly data: SalesTrendPoint[];
  readonly granularity: TrendGranularity;
  readonly isLoading?: boolean;
  readonly isError?: boolean;
  readonly onRetry?: () => void;
}

export function SalesChart({
  data,
  granularity,
  isLoading = false,
  isError = false,
  onRetry,
}: SalesChartProps): ReactNode {
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Cargando tendencia de ventas"
        className="flex items-end gap-2 rounded-3xl border border-outline-variant bg-surface p-6"
      >
        {Array.from({ length: SKELETON_BARS }, (_, index) => (
          <Skeleton key={index} className="h-32 flex-1" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-3xl border border-error bg-surface-container-low p-6"
      >
        <h3 className="text-base font-semibold text-on-surface">
          No se pudo cargar la tendencia de ventas
        </h3>
        <p className="text-sm text-on-surface-variant">
          Intenta de nuevo en unos segundos.
        </p>
        {onRetry ? (
          <Button variant="outlined" onClick={onRetry}>
            Reintentar
          </Button>
        ) : null}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="sales" />}
        title="Sin ventas en el periodo"
        description="Registra ventas para ver la tendencia dentro de este rango de fechas."
      />
    );
  }

  const max = data.reduce(
    (accumulator, point) =>
      point.totalSales > accumulator ? point.totalSales : accumulator,
    0,
  );
  const slot = VIEW_WIDTH / data.length;
  const barWidth = slot * BAR_RATIO;

  return (
    <div className="overflow-hidden rounded-3xl border border-outline-variant bg-surface p-4">
      <svg
        role="img"
        aria-label="Tendencia de ventas"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="h-auto w-full"
      >
        {data.map((point, index) => {
          const ratio = max > 0 ? point.totalSales / max : 0;
          const height =
            ratio > 0 ? Math.max(ratio * PLOT_HEIGHT, MIN_BAR_HEIGHT) : 0;
          const x = index * slot + (slot - barWidth) / 2;
          const y = PLOT_BOTTOM - height;
          const center = index * slot + slot / 2;

          return (
            <g key={point.period}>
              <title>{trendBarTitle(point, granularity)}</title>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={height}
                rx={4}
                className="fill-primary"
              />
              <text
                x={center}
                y={LABEL_Y}
                textAnchor="middle"
                className="fill-on-surface-variant text-[11px]"
              >
                {formatTrendPeriod(point.period, granularity)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
