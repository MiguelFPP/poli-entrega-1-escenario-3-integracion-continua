'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Button,
  Chip,
  EmptyState,
  Icon,
  Skeleton,
  TextField,
} from '@/components/ui';
import { extractErrorMessage } from '@/lib/api-client';
import { useCategories, useProducts } from '@/lib/catalog';
import type { Product } from '@/lib/catalog';
import { formatCurrency } from '@/lib/format';

const SEARCH_DEBOUNCE_MS = 300;

const PAGE_SIZE = 50;

const SKELETON_CARDS = 6;

export interface PosSearchProps {
  readonly onAdd: (product: Product) => void;
}

export function PosSearch({ onAdd }: PosSearchProps): ReactNode {
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);

  // La búsqueda se aplica con retardo para no pedir en cada tecla.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchText.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchText]);

  const productsQuery = useProducts({
    page: 1,
    pageSize: PAGE_SIZE,
    search: search.length > 0 ? search : undefined,
    categoryId,
    active: 'true',
    sort: 'name',
    order: 'asc',
  });
  const categoriesQuery = useCategories({ active: 'true' });

  const categories = categoriesQuery.data ?? [];
  const products = productsQuery.data?.data ?? [];

  const renderResults = (): ReactNode => {
    if (productsQuery.isLoading) {
      return (
        <div
          role="status"
          aria-label="Cargando productos"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {Array.from({ length: SKELETON_CARDS }, (_, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-3xl border border-outline-variant bg-surface p-4"
            >
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-full" />
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
          description="No encontramos productos que coincidan con la búsqueda."
        />
      );
    }

    return (
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <li
            key={product.id}
            className="flex flex-col gap-3 rounded-3xl border border-outline-variant bg-surface p-4"
          >
            <div className="flex flex-col gap-0.5">
              <h3 className="font-medium text-on-surface">{product.name}</h3>
              <p className="font-mono text-xs text-on-surface-variant">
                {product.sku}
              </p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-on-surface">
                {formatCurrency(product.salePrice)}
              </span>
              <span className="text-xs text-on-surface-variant">
                {`Stock ${product.stock}`}
              </span>
            </div>
            <Button
              size="sm"
              disabled={product.stock === 0}
              onClick={() => onAdd(product)}
            >
              Agregar
            </Button>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <section className="flex flex-col gap-4">
      <TextField
        label="Buscar producto"
        type="search"
        placeholder="Nombre o SKU"
        value={searchText}
        onChange={setSearchText}
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Categorías">
        <Chip
          label="Todas"
          variant="filter"
          selected={categoryId === undefined}
          onClick={() => {
            setCategoryId(undefined);
          }}
        />
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            variant="filter"
            selected={categoryId === category.id}
            onClick={() => {
              setCategoryId(category.id);
            }}
          />
        ))}
      </div>

      {renderResults()}
    </section>
  );
}
