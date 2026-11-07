import type { ReactNode } from 'react';
import { formatCurrency } from '@/lib/format';

export interface SaleTotalsProps {
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly taxAmount: number;
  readonly total: number;
  readonly itemCount?: number;
}

export function SaleTotals({
  subtotal,
  discountAmount,
  taxAmount,
  total,
  itemCount,
}: SaleTotalsProps): ReactNode {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <dl className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-on-surface-variant">Subtotal</dt>
          <dd className="text-on-surface">{formatCurrency(subtotal)}</dd>
        </div>

        {discountAmount > 0 ? (
          <div className="flex items-center justify-between gap-4">
            <dt className="text-on-surface-variant">Descuento</dt>
            <dd className="text-error">{`-${formatCurrency(discountAmount)}`}</dd>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4">
          <dt className="text-on-surface-variant">IVA 19% incluido</dt>
          <dd className="text-on-surface">{formatCurrency(taxAmount)}</dd>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-outline-variant pt-2 text-base font-semibold">
          <dt className="text-on-surface">Total</dt>
          <dd className="text-on-surface">{formatCurrency(total)}</dd>
        </div>
      </dl>

      {typeof itemCount === 'number' ? (
        <p className="text-xs text-on-surface-variant">
          {itemCount === 1 ? '1 producto' : `${itemCount} productos`}
        </p>
      ) : null}
    </div>
  );
}
