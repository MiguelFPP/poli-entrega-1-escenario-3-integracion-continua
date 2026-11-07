'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Button,
  Chip,
  EmptyState,
  Icon,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextField,
} from '@/components/ui';
import type { ChipVariant, SelectOption } from '@/components/ui';
import { extractErrorMessage } from '@/lib/api-client';
import { formatCurrency, formatDateTime } from '@/lib/format';
import {
  PAYMENT_METHOD_LABELS,
  SALE_STATUS_LABELS,
  useSales,
} from '@/lib/sales';
import type { SaleQuery, SaleStatus } from '@/lib/sales';

/** Valor centinela de la opción "todas" del filtro de estado. */
const ALL = 'all';

const SKELETON_ROWS = 5;

export const SALES_PAGE_SIZE = 20;

const INITIAL_QUERY: SaleQuery = { page: 1, pageSize: SALES_PAGE_SIZE };

const STATUSES: readonly SaleStatus[] = ['COMPLETED', 'VOIDED'];

const STATUS_OPTIONS: readonly SelectOption[] = [
  { value: ALL, label: 'Todas' },
  ...STATUSES.map((status) => ({
    value: status,
    label: SALE_STATUS_LABELS[status],
  })),
];

const STATUS_VARIANTS: Record<SaleStatus, ChipVariant> = {
  COMPLETED: 'assist',
  VOIDED: 'filter',
};

/** La API espera el día completo: desde las 00:00 hasta las 23:59. */
function toIsoStart(date: string): string | undefined {
  return date.length > 0 ? `${date}T00:00:00.000Z` : undefined;
}

function toIsoEnd(date: string): string | undefined {
  return date.length > 0 ? `${date}T23:59:59.999Z` : undefined;
}

export function SalesHistory(): ReactNode {
  const [query, setQuery] = useState<SaleQuery>(INITIAL_QUERY);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const salesQuery = useSales(query);

  const updateQuery = (changes: Partial<SaleQuery>): void => {
    setQuery((current) => ({ ...current, ...changes, page: 1 }));
  };

  const handleStatusChange = (value: string): void => {
    const status = STATUSES.find((candidate) => candidate === value);
    updateQuery({ status });
  };

  const handleFromChange = (value: string): void => {
    setFromDate(value);
    updateQuery({ from: toIsoStart(value) });
  };

  const handleToChange = (value: string): void => {
    setToDate(value);
    updateQuery({ to: toIsoEnd(value) });
  };

  const handleClearFilters = (): void => {
    setFromDate('');
    setToDate('');
    setQuery({ page: 1, pageSize: query.pageSize });
  };

  const goToPage = (page: number): void => {
    setQuery((current) => ({ ...current, page }));
  };

  const sales = salesQuery.data?.data ?? [];
  const meta = salesQuery.data?.meta;
  const totalPages = meta && meta.totalPages > 0 ? meta.totalPages : 1;

  const renderResults = (): ReactNode => {
    if (salesQuery.isLoading) {
      return (
        <div
          role="status"
          aria-label="Cargando ventas"
          className="flex flex-col gap-4 rounded-3xl border border-outline-variant bg-surface p-4"
        >
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      );
    }

    if (salesQuery.isError) {
      return (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-3xl border border-error bg-surface-container-low p-6"
        >
          <h3 className="text-base font-semibold text-on-surface">
            No se pudieron cargar las ventas
          </h3>
          <p className="text-sm text-on-surface-variant">
            {extractErrorMessage(salesQuery.error)}
          </p>
          <Button
            variant="outlined"
            onClick={() => {
              void salesQuery.refetch();
            }}
          >
            Reintentar
          </Button>
        </div>
      );
    }

    if (sales.length === 0) {
      return (
        <EmptyState
          icon={<Icon name="sales" />}
          title="No hay ventas"
          description="Las ventas registradas aparecerán aquí, de la más reciente a la más antigua."
        />
      );
    }

    return (
      <>
        <Table>
          <TableCaption>Historial de ventas registradas</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Artículos</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Usuario</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell>
                  <Link
                    href={`/ventas/${sale.id}`}
                    className="font-mono text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {sale.number}
                  </Link>
                </TableCell>
                <TableCell>{formatDateTime(sale.createdAt)}</TableCell>
                <TableCell>
                  <Chip
                    label={SALE_STATUS_LABELS[sale.status]}
                    variant={STATUS_VARIANTS[sale.status]}
                  />
                </TableCell>
                <TableCell>{sale.itemCount}</TableCell>
                <TableCell>
                  {sale.paymentMethod
                    ? PAYMENT_METHOD_LABELS[sale.paymentMethod]
                    : '—'}
                </TableCell>
                <TableCell>{formatCurrency(sale.total)}</TableCell>
                <TableCell>{sale.user.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-on-surface-variant">
            {`Página ${meta?.page ?? 1} de ${totalPages} · ${meta?.total ?? sales.length} ventas`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outlined"
              disabled={!meta?.hasPreviousPage}
              onClick={() => {
                goToPage((meta?.page ?? 1) - 1);
              }}
            >
              Anterior
            </Button>
            <Button
              variant="outlined"
              disabled={!meta?.hasNextPage}
              onClick={() => {
                goToPage((meta?.page ?? 1) + 1);
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Select
          label="Estado"
          options={STATUS_OPTIONS}
          value={query.status ?? ALL}
          onValueChange={handleStatusChange}
        />
        <TextField
          label="Desde"
          type="date"
          value={fromDate}
          onChange={handleFromChange}
        />
        <TextField
          label="Hasta"
          type="date"
          value={toDate}
          onChange={handleToChange}
        />
        <div className="flex items-end justify-end">
          <Button variant="text" onClick={handleClearFilters}>
            Limpiar filtros
          </Button>
        </div>
      </div>

      {renderResults()}
    </section>
  );
}
