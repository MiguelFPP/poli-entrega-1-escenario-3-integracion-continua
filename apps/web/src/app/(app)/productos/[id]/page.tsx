import type { ReactNode } from 'react';
import { ProductDetail } from '@/components/products/product-detail';

interface ProductDetailPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{
    readonly [key: string]: string | string[] | undefined;
  }>;
}

/** El detalle se resuelve en el servidor y se pasa al componente cliente. */
export default async function ProductDetailPage({
  params,
  searchParams,
}: ProductDetailPageProps): Promise<ReactNode> {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const editing = query.editar === '1';

  return <ProductDetail productId={id} editing={editing} />;
}
