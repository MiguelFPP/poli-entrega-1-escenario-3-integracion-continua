'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { ProductPicker } from '@/components/inventory/product-picker';
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
import { MOVEMENT_TYPE_LABELS, useMovements } from '@/lib/inventory';
import type { MovementQuery, MovementType } from '@/lib/inventory';

/** Valor centinela de la opción "todas" de los filtros. */
const ALL = 'all';

const SKELETON_ROWS = 5;

const INITIAL_QUERY: MovementQuery = { page: 1, pageSize: 20 };

const MOVEMENT_TYPES: readonly MovementType[] = [
  'ENTRY',
  'SALE',
  'ADJUSTMENT',
  'VOID',
];

const TYPE_OPTIONS: readonly SelectOption[] = [
  { value: ALL, label: 'Todas' },
  ...MOVEMENT_TYPES.map((type) => ({
    value: type,
    label: MOVEMENT_TYPE_LABELS[type],
  })),
];

const TYPE_VARIANTS: Record<MovementType, ChipVariant> = {
  ENTRY: 'assist',
  SALE: 'input',
  ADJUSTMENT: 'filter',
  VOID: 'filter',
};

/** La API espera el día completo: desde las 00:00 hasta las 23:59. */
function toIsoStart(date: string): string | undefined {
  return date.length > 0 ? `${date}T00:00:00.000Z` : undefined;
}

function toIsoEnd(date: string): string | undefined {
  return date.length > 0 ? `${date}T23:59:59.999Z` : undefined;
}

export function StockMovements(): ReactNode {
  const [query, setQuery] = useState<MovementQuery>(INITIAL_QUERY);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const movementsQuery = useMovements(query);

  const updateQuery = (changes: Partial<MovementQuery>): void => {
    setQuery((current) => ({ ...current, ...changes, page: 1 }));
  };

  const handleTypeChange = (value: string): void => {
    const type = MOVEMENT_TYPES.find((candidate) => candidate === value);
    updateQuery({ type });
  };

  const handleFromChange = (value: string): void => {
    setFromDate(value);
    updateQuery({ from: toIsoStart(value) });
  };

  const handleToChange = (value: string): void => {
    setToDate(value);
    updateQuery({ to: toIsoEnd(value) });
  };

  const handleProductChange = (productId: string): void => {
    updateQuery({ productId: productId.length > 0 ? productId : undefined });
  };

  const handleClearFilters = (): void => {
    setFromDate('');
    setToDate('');
    setQuery({ page: 1, pageSize: query.pageSize });
  };

  const goToPage = (page: number): void => {
    setQuery((current) => ({ ...current, page }));
  };

  const movements = movementsQuery.data?.data ?? [];
  const meta = movementsQuery.data?.meta;
  const totalPages = meta && meta.totalPages > 0 ? meta.totalPages : 1;

  const renderResults = (): ReactNode => {
    if (movementsQuery.isLoading) {
      return (
        <div
          role="status"
          aria-label="Cargando movimientos"
          className="flex flex-col gap-4 rounded-3xl border border-outline-variant bg-surface p-4"
        >
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      );
    }

    if (movementsQuery.isError) {
      return (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-3xl border border-error bg-surface-container-low p-6"
        >
          <h3 className="text-base font-semibold text-on-surface">
            No se pudieron cargar los movimientos
          </h3>
          <p className="text-sm text-on-surface-variant">
            {extractErrorMessage(movementsQuery.error)}
          </p>
          <Button
            variant="outlined"
            onClick={() => {
              void movementsQuery.refetch();
            }}
          >
            Reintentar
          </Button>
        </div>
      );
    }

    if (movements.length === 0) {
      return (
        <EmptyState
          icon={<Icon name="inventory" />}
          title="No hay movimientos registrados"
          description="Las entradas, ventas y ajustes de stock aparecerán aquí."
        />
      );
    }

    return (
      <>
        <Table>
          <TableCaption>Historial de movimientos de inventario</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Stock anterior → nuevo</TableHead>
              <TableHead>Costo unitario</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Usuario</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell>{formatDateTime(movement.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-on-surface">
                      {movement.product.name}
                    </span>
                    <span className="font-mono text-xs text-on-surface-variant">
                      {movement.product.sku}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Chip
                    label={MOVEMENT_TYPE_LABELS[movement.type]}
                    variant={TYPE_VARIANTS[movement.type]}
                  />
                </TableCell>
                <TableCell>
                  <span
                    className={
                      movement.quantity < 0
                        ? 'font-medium text-error'
                        : 'font-medium text-on-surface'
                    }
                  >
                    {movement.quantity > 0
                      ? `+${movement.quantity}`
                      : String(movement.quantity)}
                  </span>
                </TableCell>
                <TableCell>
                  {`${movement.previousStock} → ${movement.newStock}`}
                </TableCell>
                <TableCell>{formatCurrency(movement.unitCost)}</TableCell>
                <TableCell>{movement.reason ?? '—'}</TableCell>
                <TableCell>{movement.user?.name ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-on-surface-variant">
            {`Página ${meta?.page ?? 1} de ${totalPages} · ${meta?.total ?? movements.length} movimientos`}
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
      <h2 className="text-lg font-semibold text-on-surface">
        Movimientos de inventario
      </h2>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Select
          label="Tipo"
          options={TYPE_OPTIONS}
          value={query.type ?? ALL}
          onValueChange={handleTypeChange}
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
        <ProductPicker
          label="Producto"
          value={query.productId}
          onChange={handleProductChange}
        />
        <div className="flex items-end justify-end sm:col-span-2 xl:col-span-4">
          <Button variant="text" onClick={handleClearFilters}>
            Limpiar filtros
          </Button>
        </div>
      </div>

      {renderResults()}
    </section>
  );
}
