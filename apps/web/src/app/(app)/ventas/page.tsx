'use client';

import type { ReactNode } from 'react';
import { SalesHistory } from '@/components/sales/sales-history';

export default function SalesPage(): ReactNode {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-on-surface">Ventas</h1>
        <p className="text-sm text-on-surface-variant">
          Historial de ventas registradas y anuladas, con su pago y totales.
        </p>
      </header>

      <SalesHistory />
    </section>
  );
}
