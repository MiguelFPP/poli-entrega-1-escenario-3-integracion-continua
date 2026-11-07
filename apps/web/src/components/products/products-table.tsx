'use client';

import Link from 'next/link';
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
  useSnackbar,
} from '@/components/ui';
import { extractErrorMessage } from '@/lib/api-client';
import {
  parseSortOption,
  toBooleanFlag,
  useCategories,
  useProducts,
  useSetProductActive,
} from '@/lib/catalog';
import type { Product, ProductQuery } from '@/lib/catalog';
import { formatCurrency } from '@/lib/format';

/** Valor centinela de las opciones "todas" de los filtros. */
const ALL = 'all';

const SEARCH_DEBOUNCE_MS = 300;

const STATUS_OPTIONS = [
  { value: ALL, label: 'Todos' },
  { value: 'true', label: 'Activos' },
  { value: 'false', label: 'Inactivos' },
];

const STOCK_OPTIONS = [
  { value: ALL, label: 'Todos' },
  { value: 'true', label: 'Stock bajo' },
];

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Más recientes' },
  { value: 'createdAt:asc', label: 'Más antiguos' },
  { value: 'name:asc', label: 'Nombre (A-Z)' },
  { value: 'name:desc', label: 'Nombre (Z-A)' },
  { value: 'salePrice:asc', label: 'Precio: menor a mayor' },
  { value: 'salePrice:desc', label: 'Precio: mayor a menor' },
  { value: 'stock:asc', label: 'Stock: menor a mayor' },
  { value: 'stock:desc', label: 'Stock: mayor a menor' },
];

const SKELETON_ROWS = 5;

export interface ProductsTableProps {
  readonly query: ProductQuery;
  readonly onQueryChange: (next: ProductQuery) => void;
}

export function ProductsTable({
  query,
  onQueryChange,
}: ProductsTableProps): ReactNode {
  const [searchText, setSearchText] = useState(query.search ?? '');

  const productsQuery = useProducts(query);
  const categoriesQuery = useCategories();
  const setProductActive = useSetProductActive();
  const snackbar = useSnackbar();

  // La búsqueda se aplica con retardo para no pedir en cada tecla.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchText === (query.search ?? '')) {
        return;
      }
      onQueryChange({
        ...query,
        search: searchText.length > 0 ? searchText : undefined,
        page: 1,
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchText, query, onQueryChange]);

  const updateQuery = (changes: Partial<ProductQuery>): void => {
    onQueryChange({ ...query, ...changes, page: 1 });
  };

  const handleCategoryChange = (value: string): void => {
    updateQuery({ categoryId: value === ALL ? undefined : value });
  };

  const handleStatusChange = (value: string): void => {
    updateQuery({ active: value === ALL ? undefined : toBooleanFlag(value) });
  };

  const handleStockChange = (value: string): void => {
    updateQuery({ lowStock: value === ALL ? undefined : toBooleanFlag(value) });
  };

  const handleSortChange = (value: string): void => {
    const parsed = parseSortOption(value);
    if (!parsed) {
      return;
    }
    updateQuery(parsed);
  };

  const handleClearFilters = (): void => {
    setSearchText('');
    onQueryChange({
      page: 1,
      pageSize: query.pageSize,
      sort: query.sort,
      order: query.order,
    });
  };

  const handleToggleActive = (product: Product): void => {
    const nextActive = !product.active;
    setProductActive.mutate(
      { id: product.id, active: nextActive },
      {
        onSuccess: () => {
          snackbar.show(
            nextActive
              ? `El producto ${product.name} quedó activo.`
              : `El producto ${product.name} quedó inactivo.`,
          );
        },
        onError: (error) => {
          snackbar.show(extractErrorMessage(error));
        },
      },
    );
  };

  const goToPage = (page: number): void => {
    onQueryChange({ ...query, page });
  };

  const products = productsQuery.data?.data ?? [];
  const meta = productsQuery.data?.meta;
  const totalPages = meta && meta.totalPages > 0 ? meta.totalPages : 1;
  const sortValue = `${query.sort ?? 'createdAt'}:${query.order ?? 'desc'}`;

  const categoryOptions = [
    { value: ALL, label: 'Todas las categorías' },
    ...(categoriesQuery.data ?? []).map((category) => ({
      value: category.id,
      label: category.name,
    })),
  ];

  const renderResults = (): ReactNode => {
    if (productsQuery.isLoading) {
      return (
        <div
          role="status"
          aria-label="Cargando productos"
          className="flex flex-col gap-4 rounded-3xl border border-outline-variant bg-surface p-4"
        >
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      );
    }

    if (productsQuery.isError) {
      return (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-3xl border border-error bg-surface-container-low p-6"
        >
          <h3 className="text-base font-semibold text-on-surface">
            No se pudieron cargar los productos
          </h3>
          <p className="text-sm text-on-surface-variant">
            {extractErrorMessage(productsQuery.error)}
          </p>
          <Button
            variant="outlined"
            onClick={() => {
              void productsQuery.refetch();
            }}
          >
            Reintentar
          </Button>
        </div>
      );
    }

    if (products.length === 0) {
      return (
        <EmptyState
          icon={<Icon name="products" />}
          title="No hay productos"
          description="No encontramos productos que coincidan con los filtros aplicados."
          action={
            <Button variant="outlined" onClick={handleClearFilters}>
              Limpiar filtros
            </Button>
          }
        />
      );
    }

    return (
      <>
        <Table>
          <TableCaption>Listado de productos del catálogo</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Precio de venta</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <span className="font-mono text-xs">{product.sku}</span>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/productos/${product.id}`}
                    className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {product.name}
                  </Link>
                </TableCell>
                <TableCell>{product.category.name}</TableCell>
                <TableCell>{formatCurrency(product.salePrice)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{product.stock}</span>
                    {product.lowStock ? (
                      <Chip
                        label="Stock bajo"
                        variant="filter"
                        icon={<Icon name="warning" size="size-3.5" />}
                      />
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <Chip
                    label={product.active ? 'Activo' : 'Inactivo'}
                    variant={product.active ? 'assist' : 'filter'}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/productos/${product.id}?editar=1`}
                      aria-label={`Editar ${product.name}`}
                      className="rounded-full px-3 py-1 text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      Editar
                    </Link>
                    <Button
                      size="sm"
                      variant="text"
                      aria-label={`${product.active ? 'Desactivar' : 'Activar'} ${product.name}`}
                      disabled={
                        setProductActive.isPending &&
                        setProductActive.variables?.id === product.id
                      }
                      onClick={() => handleToggleActive(product)}
                    >
                      {product.active ? 'Desactivar' : 'Activar'}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-on-surface-variant">
            {`Página ${meta?.page ?? 1} de ${totalPages} · ${meta?.total ?? products.length} resultados`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outlined"
              disabled={!meta?.hasPreviousPage}
              onClick={() => goToPage((meta?.page ?? 1) - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outlined"
              disabled={!meta?.hasNextPage}
              onClick={() => goToPage((meta?.page ?? 1) + 1)}
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <TextField
          label="Buscar"
          type="search"
          placeholder="Nombre, SKU o código de barras"
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
        <Select
          label="Estado"
          options={STATUS_OPTIONS}
          value={query.active ?? ALL}
          onValueChange={handleStatusChange}
        />
        <Select
          label="Stock"
          options={STOCK_OPTIONS}
          value={query.lowStock ?? ALL}
          onValueChange={handleStockChange}
        />
        <Select
          label="Orden"
          options={SORT_OPTIONS}
          value={sortValue}
          onValueChange={handleSortChange}
        />
      </div>

      {renderResults()}
    </section>
  );
}
