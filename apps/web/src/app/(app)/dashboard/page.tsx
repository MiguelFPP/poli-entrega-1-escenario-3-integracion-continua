import type { ReactNode } from 'react';

export default function DashboardPage(): ReactNode {
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-surface-container p-6">
      <h2 className="text-xl font-semibold text-on-surface">Dashboard</h2>
      <p className="max-w-2xl text-sm leading-relaxed text-on-surface-variant">
        Los indicadores de ventas, mermas y rotación de inventario llegan en la
        fase de dashboard. Por ahora esta pantalla es un placeholder del
        esqueleto de la aplicación.
      </p>
    </section>
  );
}
