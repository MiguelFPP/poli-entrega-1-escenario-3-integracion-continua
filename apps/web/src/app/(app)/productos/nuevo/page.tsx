'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { ProductForm } from '@/components/products/product-form';

export default function NewProductPage(): ReactNode {
  const router = useRouter();

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-on-surface">
            Nuevo producto
          </h1>
          <p className="text-sm text-on-surface-variant">
            El stock inicial siempre es 0: lo gestionan los movimientos de
            inventario.
          </p>
        </div>
        <Link
          href="/productos"
          className="inline-flex h-10 items-center justify-center rounded-full border border-outline px-4 text-sm font-medium text-on-surface transition-colors duration-150 hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Volver al catálogo
        </Link>
      </header>

      <ProductForm
        mode="create"
        onSuccess={() => {
          router.push('/productos');
          router.refresh();
        }}
      />
    </section>
  );
}
