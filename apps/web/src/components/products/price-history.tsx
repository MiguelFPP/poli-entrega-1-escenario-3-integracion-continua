'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Button,
  EmptyState,
  Icon,
  Skeleton,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { extractErrorMessage } from '@/lib/api-client';
import { usePriceHistory } from '@/lib/catalog';
import type { PriceHistoryField } from '@/lib/catalog';
import { formatCurrency, formatDateTime } from '@/lib/format';

const PAGE_SIZE = 10;

const FIELD_LABELS: Record<PriceHistoryField, string> = {
  COST: 'Costo',
  SALE: 'Precio de venta',
};

const SKELETON_ROWS = 4;

export interface PriceHistoryProps {
  readonly productId: string;
}

export function PriceHistory({ productId }: PriceHistoryProps): ReactNode {
  const [page, setPage] = useState(1);
  const historyQuery = usePriceHistory(productId, page, PAGE_SIZE);

  const entries = historyQuery.data?.data ?? [];
  const meta = historyQuery.data?.meta;
  const totalPages = meta && meta.totalPages > 0 ? meta.totalPages : 1;

  const renderRows = (): ReactNode => {
    if (historyQuery.isLoading) {
      return (
        <div
          role="status"
          aria-label="Cargando historial de precios"
          className="flex flex-col gap-4 rounded-3xl border border-outline-variant bg-surface p-4"
        >
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      );
    }

    if (historyQuery.isError) {
      return (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-3xl border border-error bg-surface-container-low p-6"
        >
          <h3 className="text-base font-semibold text-on-surface">
            No se pudo cargar el historial de precios
          </h3>
          <p className="text-sm text-on-surface-variant">
            {extractErrorMessage(historyQuery.error)}
          </p>
          <Button
            variant="outlined"
            onClick={() => {
              void historyQuery.refetch();
            }}
          >
            Reintentar
          </Button>
        </div>
      );
    }

    if (entries.length === 0) {
      return (
        <EmptyState
          icon={<Icon name="sales" />}
          title="Sin cambios de precio"
          description="Este producto todavía no registra cambios de precio."
        />
      );
    }

    return (
      <>
        <Table>
          <TableCaption>Historial de cambios de precio</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Campo</TableHead>
              <TableHead>Valor anterior</TableHead>
              <TableHead>Valor nuevo</TableHead>
              <TableHead>Autor</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{FIELD_LABELS[entry.field]}</TableCell>
                <TableCell>{formatCurrency(entry.oldValue)}</TableCell>
                <TableCell>{formatCurrency(entry.newValue)}</TableCell>
                <TableCell>{entry.changedBy?.name ?? 'Sistema'}</TableCell>
                <TableCell>{formatDateTime(entry.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-on-surface-variant">
            {`Página ${meta?.page ?? 1} de ${totalPages} · ${meta?.total ?? entries.length} cambios`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outlined"
              disabled={!meta?.hasPreviousPage}
              onClick={() => {
                setPage((current) => Math.max(1, current - 1));
              }}
            >
              Anterior
            </Button>
            <Button
              variant="outlined"
              disabled={!meta?.hasNextPage}
              onClick={() => {
                setPage((current) => current + 1);
              }}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </>
    );
  };

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-on-surface">
        Historial de precios
      </h2>
      {renderRows()}
    </section>
  );
}
