'use client';

import type { ReactNode } from 'react';
import {
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
import type { DashboardLowStockItem } from '@/lib/dashboard';

const SKELETON_ROWS = 4;

export interface DashboardLowStockProps {
  readonly data: DashboardLowStockItem[];
  readonly isLoading?: boolean;
}

export function DashboardLowStock({
  data,
  isLoading = false,
}: DashboardLowStockProps): ReactNode {
  const renderContent = (): ReactNode => {
    if (isLoading) {
      return (
        <div
          role="status"
          aria-label="Cargando alertas de stock"
          className="flex flex-col gap-4 rounded-3xl border border-outline-variant bg-surface p-4"
        >
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <EmptyState
          icon={<Icon name="check" />}
          title="Sin alertas de stock"
          description="Todos los productos están por encima de su stock mínimo."
        />
      );
    }

    return (
      <Table>
        <TableCaption>Productos en o por debajo de su stock mínimo</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Mínimo</TableHead>
            <TableHead>Déficit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-on-surface">
                    {item.name}
                  </span>
                  <span className="font-mono text-xs text-on-surface-variant">
                    {item.sku}
                  </span>
                </div>
              </TableCell>
              <TableCell>{item.stock}</TableCell>
              <TableCell>{item.minStock}</TableCell>
              <TableCell>
                <span className="font-medium text-error">{item.deficit}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-on-surface">Alertas de stock</h2>
      {renderContent()}
    </section>
  );
}
