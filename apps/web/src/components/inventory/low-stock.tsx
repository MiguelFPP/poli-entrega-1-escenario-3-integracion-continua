'use client';

import { useEffect, useState } from 'react';
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
import { extractErrorMessage } from '@/lib/api-client';
import { useCategories } from '@/lib/catalog';
import { formatCurrency } from '@/lib/format';
import { useLowStock } from '@/lib/inventory';
import type { LowStockQuery } from '@/lib/inventory';

/** Valor centinela de la opción "todas" de los filtros. */
const ALL = 'all';

const SEARCH_DEBOUNCE_MS = 300;

const SKELETON_ROWS = 5;

const INITIAL_QUERY: LowStockQuery = { page: 1, pageSize: 20 };

export function LowStock(): ReactNode {
  const [query, setQuery] = useState<LowStockQuery>(INITIAL_QUERY);
  const [searchText, setSearchText] = useState('');

  const lowStockQuery = useLowStock(query);
  const categoriesQuery = useCategories();

  // La búsqueda se aplica con retardo para no pedir en cada tecla.
  useEffect(() => {
    const search = searchText.trim();
    const timer = setTimeout(() => {
      setQuery((current) => {
        if ((current.search ?? '') === search) {
          return current;
        }
        return {
          ...current,
          search: search.length > 0 ? search : undefined,
          page: 1,
        };
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchText]);

  const updateQuery = (changes: Partial<LowStockQuery>): void => {
    setQuery((current) => ({ ...current, ...changes, page: 1 }));
  };

  const handleCategoryChange = (value: string): void => {
    updateQuery({ categoryId: value === ALL ? undefined : value });
  };

  const handleClearFilters = (): void => {
    setSearchText('');
    setQuery({ page: 1, pageSize: query.pageSize });
  };

  const goToPage = (page: number): void => {
    setQuery((current) => ({ ...current, page }));
  };

  const items = lowStockQuery.data?.data ?? [];
  const meta = lowStockQuery.data?.meta;
  const totalPages = meta && meta.totalPages > 0 ? meta.totalPages : 1;

  const categoryOptions = [
    { value: ALL, label: 'Todas' },
    ...(categoriesQuery.data ?? []).map((category) => ({
      value: category.id,
      label: category.name,
    })),
  ];

  const renderResults = (): ReactNode => {
    if (lowStockQuery.isLoading) {
      return (
        <div
          role="status"
          aria-label="Cargando stock bajo"
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

    if (lowStockQuery.isError) {
      return (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-3xl border border-error bg-surface-container-low p-6"
        >
          <h3 className="text-base font-semibold text-on-surface">
            No se pudo cargar el stock bajo
          </h3>
          <p className="text-sm text-on-surface-variant">
            {extractErrorMessage(lowStockQuery.error)}
          </p>
          <Button
            variant="outlined"
            onClick={() => {
              void lowStockQuery.refetch();
            }}
          >
            Reintentar
          </Button>
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <EmptyState
          icon={<Icon name="warning" />}
          title="No hay productos con stock bajo"
          description="Todos los productos del catálogo están por encima de su stock mínimo."
        />
      );
    }

    return (
      <>
        <Table>
          <TableCaption>Productos por debajo de su stock mínimo</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Mínimo</TableHead>
              <TableHead>Déficit</TableHead>
              <TableHead>Valorización</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <span className="font-mono text-xs">{item.sku}</span>
                </TableCell>
                <TableCell className="font-medium text-on-surface">
                  {item.name}
                </TableCell>
                <TableCell>{item.category.name}</TableCell>
                <TableCell>{item.stock}</TableCell>
                <TableCell>{item.minStock}</TableCell>
                <TableCell>
                  <Chip
                    label={String(item.deficit)}
                    variant="filter"
                    icon={<Icon name="warning" size="size-3.5" />}
                  />
                </TableCell>
                <TableCell>{formatCurrency(item.inventoryValue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-on-surface-variant">
            {`Página ${meta?.page ?? 1} de ${totalPages} · ${meta?.total ?? items.length} productos`}
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
        Productos con stock bajo
      </h2>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TextField
          label="Buscar"
          type="search"
          placeholder="Nombre o SKU"
          value={searchText}
          onChange={setSearchText}
          className="sm:col-span-2"
        />
        <Select
          label="Categoría"
          options={categoryOptions}
          value={query.categoryId ?? ALL}
          onValueChange={handleCategoryChange}
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
