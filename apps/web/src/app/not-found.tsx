import Link from 'next/link';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui';
import { Icon } from '@/components/ui/icons';

export default function NotFound(): ReactNode {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-xl">
        <EmptyState
          icon={<Icon name="warning" />}
          title="Página no encontrada"
          description="La ruta que buscas no existe o todavía no está disponible."
          action={
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-on-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Volver al dashboard
            </Link>
          }
        />
      </div>
    </main>
  );
}
