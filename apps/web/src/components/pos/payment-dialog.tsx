'use client';

import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Button,
  Dialog,
  Select,
  TextField,
  useSnackbar,
} from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { extractErrorMessage } from '@/lib/api-client';
import { computeCartTotals } from '@/lib/cart-totals';
import { formatCurrency } from '@/lib/format';
import { PAYMENT_METHOD_LABELS, useCreateSale } from '@/lib/sales';
import type { PaymentMethodName, SaleDetail } from '@/lib/sales';
import { useCartStore } from '@/stores/cart-store';
import { SaleTotals } from './sale-totals';

const METHOD_OPTIONS: readonly SelectOption[] = [
  { value: 'CASH', label: PAYMENT_METHOD_LABELS.CASH },
  { value: 'CARD', label: PAYMENT_METHOD_LABELS.CARD },
];

interface PaymentFormProps {
  readonly onCancel: () => void;
  readonly onCompleted: (sale: SaleDetail) => void;
}

function PaymentForm({ onCancel, onCompleted }: PaymentFormProps): ReactNode {
  const items = useCartStore((state) => state.items);
  const discountAmount = useCartStore((state) => state.discountAmount);
  const clear = useCartStore((state) => state.clear);

  const createSale = useCreateSale();
  const snackbar = useSnackbar();

  const [method, setMethod] = useState<PaymentMethodName>('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [cashError, setCashError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const totals = computeCartTotals(items, discountAmount);
  const cashValue = Number(cashReceived);
  const hasCash = cashReceived.trim().length > 0 && Number.isFinite(cashValue);
  const change = hasCash ? cashValue - totals.total : 0;
  const pending = createSale.isPending;

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setServerError(null);

    if (items.length === 0) {
      setServerError('El carrito está vacío.');
      return;
    }

    if (method === 'CASH') {
      if (!hasCash) {
        setCashError('El efectivo recibido es obligatorio');
        return;
      }
      if (cashValue < totals.total) {
        setCashError('El efectivo recibido debe ser mayor o igual al total');
        return;
      }
    }

    setCashError(null);

    try {
      const sale = await createSale.mutateAsync({
        items: items.map(({ productId, quantity }) => ({
          productId,
          quantity,
        })),
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        payment: {
          method,
          cashReceived: method === 'CASH' ? cashValue : undefined,
        },
      });
      clear();
      snackbar.show('Venta registrada.');
      onCompleted(sale);
      onCancel();
    } catch (error) {
      setServerError(extractErrorMessage(error));
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <SaleTotals
        subtotal={totals.subtotal}
        discountAmount={totals.discountAmount}
        taxAmount={totals.taxAmount}
        total={totals.total}
        itemCount={items.length}
      />

      <Select
        label="Método de pago"
        options={METHOD_OPTIONS}
        value={method}
        onValueChange={(value) => {
          setMethod(value === 'CARD' ? 'CARD' : 'CASH');
          setCashError(null);
        }}
        disabled={pending}
      />

      {method === 'CASH' ? (
        <>
          <TextField
            label="Efectivo recibido"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            required
            placeholder="0"
            disabled={pending}
            value={cashReceived}
            onChange={(value) => {
              setCashReceived(value);
              setCashError(null);
            }}
            error={cashError ?? undefined}
          />
          {cashError === null && hasCash && change >= 0 ? (
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-on-surface-variant">Cambio</span>
              <span className="font-medium text-on-surface">
                {formatCurrency(change)}
              </span>
            </div>
          ) : null}
        </>
      ) : null}

      {serverError ? (
        <p role="alert" className="text-sm text-error">
          {serverError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          variant="text"
          type="button"
          disabled={pending}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="submit" loading={pending} disabled={pending}>
          Cobrar
        </Button>
      </div>
    </form>
  );
}

export interface PaymentDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCompleted: (sale: SaleDetail) => void;
}

export function PaymentDialog({
  open,
  onOpenChange,
  onCompleted,
}: PaymentDialogProps): ReactNode {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cobrar venta"
      description="Confirma el método de pago y el efectivo recibido para cerrar la venta."
    >
      <PaymentForm
        onCancel={() => {
          onOpenChange(false);
        }}
        onCompleted={onCompleted}
      />
    </Dialog>
  );
}
