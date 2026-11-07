'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { PriceHistory } from '@/components/products/price-history';
import { ProductForm } from '@/components/products/product-form';
import { Button, Chip, EmptyState, Icon, Skeleton } from '@/components/ui';
import { extractErrorMessage } from '@/lib/api-client';
import { useProduct } from '@/lib/catalog';
import { formatCurrency } from '@/lib/format';

export interface ProductDetailProps {
  readonly productId: string;
  readonly editing: boolean;
}

function DetailRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium tracking-wide text-on-surface-variant uppercase">
        {label}
      </dt>
      <dd className="text-sm text-on-surface">{children}</dd>
    </div>
  );
}

export function ProductDetail({
  productId,
  editing,
}: ProductDetailProps): ReactNode {
  const router = useRouter();
  const productQuery = useProduct(productId);

  if (productQuery.isLoading) {
    return (
      <section
        role="status"
        aria-label="Cargando producto"
        className="flex flex-col gap-4 rounded-3xl bg-surface-container p-6"
      >
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-32 w-full" />
      </section>
    );
  }

  if (productQuery.isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-3xl border border-error bg-surface-container-low p-6"
      >
        <h1 className="text-lg font-semibold text-on-surface">
          No se pudo cargar el producto
        </h1>
        <p className="text-sm text-on-surface-variant">
          {extractErrorMessage(productQuery.error)}
        </p>
        <Button
          variant="outlined"
          onClick={() => {
            void productQuery.refetch();
          }}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  const product = productQuery.data;

  // `null` significa que la API respondió 404: el producto no existe.
  if (product === null) {
    return (
      <EmptyState
        icon={<Icon name="products" />}
        title="Producto no encontrado"
        description="El producto no existe o fue eliminado del catálogo."
        action={
          <Link
            href="/productos"
            className="inline-flex h-10 items-center justify-center rounded-full border border-outline px-4 text-sm font-medium text-on-surface transition-colors duration-150 hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Volver al catálogo
          </Link>
        }
      />
    );
  }

  // `undefined` es el estado de carga inicial de la consulta.
  if (!product) {
    return (
      <section
        role="status"
        aria-label="Cargando producto"
        className="flex flex-col gap-4 rounded-3xl bg-surface-container p-6"
      >
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-32 w-full" />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-on-surface">
            {product.name}
          </h1>
          <p className="text-sm text-on-surface-variant">
            {`SKU ${product.sku}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <Button
              variant="outlined"
              onClick={() => {
                router.push(`/productos/${product.id}`);
                router.refresh();
              }}
            >
              Cancelar edición
            </Button>
          ) : (
            <Link
              href={`/productos/${product.id}?editar=1`}
              className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-on-primary transition-colors duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Editar
            </Link>
          )}
          <Link
            href="/productos"
            className="inline-flex h-10 items-center justify-center rounded-full border border-outline px-4 text-sm font-medium text-on-surface transition-colors duration-150 hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Volver al catálogo
          </Link>
        </div>
      </header>

      {editing ? (
        <ProductForm
          mode="edit"
          product={product}
          onSuccess={() => {
            router.push(`/productos/${product.id}`);
            router.refresh();
          }}
        />
      ) : (
        <dl className="grid gap-4 rounded-3xl bg-surface-container-low p-6 sm:grid-cols-2 lg:grid-cols-3">
          <DetailRow label="SKU">
            <span className="font-mono text-xs">{product.sku}</span>
          </DetailRow>
          <DetailRow label="Categoría">{product.category.name}</DetailRow>
          <DetailRow label="Costo">
            {formatCurrency(product.costPrice)}
          </DetailRow>
          <DetailRow label="Precio de venta">
            {formatCurrency(product.salePrice)}
          </DetailRow>
          <DetailRow label="Stock">
            <span className="flex items-center gap-2">
              {product.stock}
              {product.lowStock ? (
                <Chip
                  label="Stock bajo"
                  variant="filter"
                  icon={<Icon name="warning" size="size-3.5" />}
                />
              ) : null}
            </span>
          </DetailRow>
          <DetailRow label="Stock mínimo">{product.minStock}</DetailRow>
          <DetailRow label="Unidad">{product.unit}</DetailRow>
          <DetailRow label="Estado">
            <Chip
              label={product.active ? 'Activo' : 'Inactivo'}
              variant={product.active ? 'assist' : 'filter'}
            />
          </DetailRow>
          <DetailRow label="Código de barras">
            {product.barcode ?? '—'}
          </DetailRow>
          <div className="flex flex-col gap-0.5 sm:col-span-2 lg:col-span-3">
            <dt className="text-xs font-medium tracking-wide text-on-surface-variant uppercase">
              Descripción
            </dt>
            <dd className="text-sm text-on-surface">
              {product.description ?? '—'}
            </dd>
          </div>
        </dl>
      )}

      <PriceHistory productId={product.id} />
    </section>
  );
}
