import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';

export default function HomePage(): ReactNode {
  return (
    <AppShell>
      <section className="flex flex-col gap-3 rounded-3xl bg-surface-container p-6">
        <h2 className="text-xl font-semibold text-on-surface">
          Bienvenido al sistema POS
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-on-surface-variant">
          Este es el esqueleto de la aplicación. En esta fase solo se valida la
          infraestructura: contenedores de web, API y base de datos, endpoint de
          salud y documentación Swagger.
        </p>
      </section>
    </AppShell>
  );
}
