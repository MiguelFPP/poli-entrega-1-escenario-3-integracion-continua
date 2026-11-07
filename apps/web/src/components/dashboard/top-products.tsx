'use client';

import type { ReactNode } from 'react';
import {
  Button,
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
} from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { TOP_PRODUCT_SORT_LABELS } from '@/lib/dashboard';
import type { TopProduct, TopProductSort } from '@/lib/dashboard';
import { formatCurrency } from '@/lib/format';

const SORT_FIELDS: readonly TopProductSort[] = ['quantity', 'revenue', 'profit'];

const SORT_OPTIONS: readonly SelectOption[] = SORT_FIELDS.map((value) => ({
  value,
  label: TOP_PRODUCT_SORT_LABELS[value],
}));

const SKELETON_ROWS = 5;

export interface TopProductsProps {
  readonly data: TopProduct[];
  readonly sortBy: TopProductSort;
  readonly onSortChange: (next: TopProductSort) => void;
  readonly isLoading?: boolean;
  readonly isError?: boolean;
  readonly onRetry?: () => void;
}

export function TopProducts({
  data,
  sortBy,
  onSortChange,
  isLoading = false,
  isError = false,
  onRetry,
}: TopProductsProps): ReactNode {
  const handleSortChange = (value: string): void => {
    const next = SORT_FIELDS.find((candidate) => candidate === value);
    if (next) {
      onSortChange(next);
    }
  };

  const renderContent = (): ReactNode => {
    if (isLoading) {
      return (
        <div
          role="status"
          aria-label="Cargando productos más vendidos"
          className="flex flex-col gap-4 rounded-3xl border border-outline-variant bg-surface p-4"
        >
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
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
            No se pudieron cargar los productos más vendidos
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
          icon={<Icon name="products" />}
          title="Sin productos vendidos"
          description="Las ventas de este periodo todavía no registran productos."
        />
      );
    }

    return (
      <Table>
        <TableCaption>Productos más vendidos del periodo</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Unidades</TableHead>
            <TableHead>Ingresos</TableHead>
            <TableHead>Ganancia</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((product, index) => (
            <TableRow key={product.productId}>
              <TableCell>{index + 1}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-on-surface">
                    {product.name}
                  </span>
                  <span className="font-mono text-xs text-on-surface-variant">
                    {product.sku}
                  </span>
                </div>
              </TableCell>
              <TableCell>{product.quantity}</TableCell>
              <TableCell>{formatCurrency(product.revenue)}</TableCell>
              <TableCell>{formatCurrency(product.profit)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold text-on-surface">
          Productos más vendidos
        </h2>
        <Select
          label="Ordenar por"
          options={SORT_OPTIONS}
          value={sortBy}
          onValueChange={handleSortChange}
          className="w-full sm:w-48"
        />
      </div>

      {renderContent()}
    </section>
  );
}
