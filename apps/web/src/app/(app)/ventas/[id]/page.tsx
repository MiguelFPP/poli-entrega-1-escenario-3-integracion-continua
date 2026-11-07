import Link from 'next/link';
import type { ReactNode } from 'react';
import { SaleDetail } from '@/components/sales/sale-detail';

interface SaleDetailPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{
    readonly [key: string]: string | string[] | undefined;
  }>;
}

/** El detalle se resuelve en el servidor y se pasa al componente cliente. */
export default async function SaleDetailPage({
  params,
  searchParams,
}: SaleDetailPageProps): Promise<ReactNode> {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const isNew = query.nueva === '1';

  return (
    <section className="flex flex-col gap-6">
      <Link
        href="/ventas"
        className="inline-flex h-10 w-fit items-center justify-center rounded-full border border-outline px-4 text-sm font-medium text-on-surface transition-colors duration-150 hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Volver a ventas
      </Link>

      <SaleDetail saleId={id} isNew={isNew} />
    </section>
  );
}
