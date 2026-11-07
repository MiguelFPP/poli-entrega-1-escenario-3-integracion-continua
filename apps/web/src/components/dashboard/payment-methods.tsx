'use client';

import type { ReactNode } from 'react';
import { EmptyState, Icon, Skeleton } from '@/components/ui';
import type { PaymentMethodStat } from '@/lib/dashboard';
import { formatCurrency } from '@/lib/format';
import { PAYMENT_METHOD_LABELS } from '@/lib/sales';

const PERCENT_FORMATTER = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 1,
});

const SKELETON_ROWS = 2;

/** Participación de un método sobre el total cobrado; `0` si no hay cobros. */
function shareOf(amount: number, totalAmount: number): number {
  return totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
}

export interface PaymentMethodsProps {
  readonly data: PaymentMethodStat[];
  readonly total: { readonly transactions: number; readonly amount: number };
  readonly isLoading?: boolean;
}

export function PaymentMethods({
  data,
  total,
  isLoading = false,
}: PaymentMethodsProps): ReactNode {
  const renderContent = (): ReactNode => {
    if (isLoading) {
      return (
        <div
          role="status"
          aria-label="Cargando métodos de pago"
          className="flex flex-col gap-4 rounded-3xl border border-outline-variant bg-surface p-4"
        >
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <EmptyState
          icon={<Icon name="point-of-sale" />}
          title="Sin cobros en el periodo"
          description="Los pagos registrados aparecerán repartidos por método."
        />
      );
    }

    return (
      <ul className="flex flex-col gap-5">
        {data.map((stat) => {
          const share = shareOf(stat.amount, total.amount);
          return (
            <li key={stat.method} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium text-on-surface">
                  {PAYMENT_METHOD_LABELS[stat.method]}
                </span>
                <span className="text-on-surface-variant">
                  {`${PERCENT_FORMATTER.format(share)}%`}
                </span>
              </div>
              <div
                aria-hidden="true"
                className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${share}%` }}
                />
              </div>
              <p className="text-xs text-on-surface-variant">
                {`${stat.transactions} cobros · ${formatCurrency(stat.amount)}`}
              </p>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-on-surface">
        Métodos de pago
      </h2>
      {renderContent()}
    </section>
  );
}
