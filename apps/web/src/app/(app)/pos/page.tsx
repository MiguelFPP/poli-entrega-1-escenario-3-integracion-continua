'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { CartPanel } from '@/components/pos/cart-panel';
import { PaymentDialog } from '@/components/pos/payment-dialog';
import { PosSearch } from '@/components/pos/pos-search';
import { useCartStore } from '@/stores/cart-store';

export default function PosPage(): ReactNode {
  const router = useRouter();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  // El carrito persiste sin hidratar en SSR: se rehidrata una vez en cliente.
  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-on-surface">
          Punto de venta
        </h1>
        <p className="text-sm text-on-surface-variant">
          Busca productos, arma el carrito y cobra la venta en efectivo o con
          tarjeta.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <PosSearch
          onAdd={(product) =>
            addItem({
              id: product.id,
              sku: product.sku,
              name: product.name,
              unitPrice: product.salePrice,
              stock: product.stock,
            })
          }
        />
        <div className="lg:sticky lg:top-20 lg:self-start">
          <CartPanel
            onCheckout={() => {
              setPaymentOpen(true);
            }}
          />
        </div>
      </div>

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        onCompleted={(sale) => {
          router.push(`/ventas/${sale.id}?nueva=1`);
        }}
      />
    </section>
  );
}
