'use client';

import type { ReactNode } from 'react';
import { Button, EmptyState, Icon, TextField } from '@/components/ui';
import { computeCartTotals } from '@/lib/cart-totals';
import { formatCurrency } from '@/lib/format';
import { useCartStore } from '@/stores/cart-store';
import { SaleTotals } from './sale-totals';

export interface CartPanelProps {
  readonly onCheckout: () => void;
}

export function CartPanel({ onCheckout }: CartPanelProps): ReactNode {
  const items = useCartStore((state) => state.items);
  const discountAmount = useCartStore((state) => state.discountAmount);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const setDiscount = useCartStore((state) => state.setDiscount);

  const totals = computeCartTotals(items, discountAmount);
  const isEmpty = items.length === 0;

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-outline-variant bg-surface p-4">
      <h2 className="text-lg font-semibold text-on-surface">Carrito</h2>

      {isEmpty ? (
        <EmptyState
          icon={<Icon name="point-of-sale" />}
          title="El carrito está vacío"
          description="Agrega productos desde el buscador para cobrar una venta."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li
                key={item.productId}
                className="flex flex-col gap-2 rounded-2xl border border-outline-variant p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="font-medium text-on-surface">
                      {item.name}
                    </span>
                    <span className="font-mono text-xs text-on-surface-variant">
                      {item.sku}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="text"
                    aria-label={`Quitar ${item.name}`}
                    onClick={() => {
                      removeItem(item.productId);
                    }}
                  >
                    Quitar
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outlined"
                      aria-label={`Disminuir ${item.name}`}
                      onClick={() => {
                        setQuantity(item.productId, item.quantity - 1);
                      }}
                    >
                      −
                    </Button>
                    <span className="min-w-8 text-center text-sm text-on-surface">
                      {item.quantity}
                    </span>
                    <Button
                      size="sm"
                      variant="outlined"
                      aria-label={`Aumentar ${item.name}`}
                      disabled={item.quantity >= item.stock}
                      onClick={() => {
                        setQuantity(item.productId, item.quantity + 1);
                      }}
                    >
                      +
                    </Button>
                  </div>
                  <span className="text-sm font-medium text-on-surface">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </span>
                </div>

                <p className="text-xs text-on-surface-variant">
                  {`${formatCurrency(item.unitPrice)} c/u`}
                </p>
              </li>
            ))}
          </ul>

          <TextField
            label="Descuento (COP)"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={String(discountAmount)}
            onChange={(value) => {
              setDiscount(Number(value));
            }}
            helperText="Se prorratea entre las líneas."
          />

          <SaleTotals
            subtotal={totals.subtotal}
            discountAmount={totals.discountAmount}
            taxAmount={totals.taxAmount}
            total={totals.total}
            itemCount={items.length}
          />
        </>
      )}

      <Button fullWidth disabled={isEmpty} onClick={onCheckout}>
        Cobrar
      </Button>
    </section>
  );
}
