'use client';

import type { ReactNode } from 'react';
import { Button, Skeleton } from '@/components/ui';
import { extractErrorMessage } from '@/lib/api-client';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { useInventorySummary } from '@/lib/inventory';

const SKELETON_CARDS = 4;

export function InventorySummary(): ReactNode {
  const summaryQuery = useInventorySummary();

  const renderContent = (): ReactNode => {
    if (summaryQuery.isLoading) {
      return (
        <div
          role="status"
          aria-label="Cargando resumen de inventario"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {Array.from({ length: SKELETON_CARDS }, (_, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-3xl border border-outline-variant bg-surface p-5"
            >
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-7 w-24" />
            </div>
          ))}
        </div>
      );
    }

    if (summaryQuery.isError) {
      return (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-3xl border border-error bg-surface-container-low p-6"
        >
          <h3 className="text-base font-semibold text-on-surface">
            No se pudo cargar el resumen de inventario
          </h3>
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

    const summary = summaryQuery.data;
    if (!summary) {
      return null;
    }

    const metrics = [
      { label: 'Unidades en stock', value: String(summary.totalUnits) },
      { label: 'Valorización', value: formatCurrency(summary.inventoryValue) },
      { label: 'Stock bajo', value: String(summary.lowStockCount) },
      { label: 'Agotados', value: String(summary.outOfStockCount) },
    ];

    return (
      <>
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex flex-col gap-1 rounded-3xl border border-outline-variant bg-surface p-5"
            >
              <dt className="text-sm text-on-surface-variant">
                {metric.label}
              </dt>
              <dd className="text-2xl font-semibold text-on-surface">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>

        <p className="text-xs text-on-surface-variant">
          {`${summary.totalProducts} productos en el catálogo · Actualizado el ${formatDateTime(summary.generatedAt)}`}
        </p>
      </>
    );
  };

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-on-surface">
        Resumen de inventario
      </h2>
      {renderContent()}
    </section>
  );
}
