'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { ProductsTable } from '@/components/products/products-table';
import { Icon } from '@/components/ui';
import type { ProductQuery } from '@/lib/catalog';

const INITIAL_QUERY: ProductQuery = { page: 1, pageSize: 20 };

export default function ProductsPage(): ReactNode {
  const [query, setQuery] = useState<ProductQuery>(INITIAL_QUERY);
  const handleQueryChange = useCallback((next: ProductQuery) => {
    setQuery(next);
  }, []);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-on-surface">Productos</h1>
          <p className="text-sm text-on-surface-variant">
            Catálogo de productos: precios de venta, stock y estado.
          </p>
        </div>
        <Link
          href="/productos/nuevo"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-on-primary transition-colors duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Icon name="add" size="size-4" />
          Nuevo producto
        </Link>
      </header>

      <ProductsTable query={query} onQueryChange={handleQueryChange} />
    </section>
  );
}
