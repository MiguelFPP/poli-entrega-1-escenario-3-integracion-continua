'use client';

import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Button, Dialog, TextArea, useSnackbar } from '@/components/ui';
import { extractErrorMessage } from '@/lib/api-client';
import { useVoidSale } from '@/lib/sales';
import type { SaleDetail } from '@/lib/sales';

const MIN_REASON = 3;
const MAX_REASON = 255;

interface VoidFormProps {
  readonly saleId: string;
  readonly onCancel: () => void;
  readonly onVoided?: (sale: SaleDetail) => void;
}

function VoidForm({ saleId, onCancel, onVoided }: VoidFormProps): ReactNode {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const voidSale = useVoidSale();
  const snackbar = useSnackbar();

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setServerError(null);

    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON) {
      setReasonError(`El motivo debe tener al menos ${MIN_REASON} caracteres`);
      return;
    }
    if (trimmed.length > MAX_REASON) {
      setReasonError(`El motivo no puede superar ${MAX_REASON} caracteres`);
      return;
    }
    setReasonError(null);

    try {
      const sale = await voidSale.mutateAsync({ id: saleId, reason: trimmed });
      snackbar.show('Venta anulada.');
      onVoided?.(sale);
      onCancel();
    } catch (error) {
      setServerError(extractErrorMessage(error));
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextArea
        label="Motivo"
        required
        maxLength={MAX_REASON}
        placeholder="Error de digitación del cajero"
        disabled={voidSale.isPending}
        value={reason}
        onChange={(value) => {
          setReason(value);
          setReasonError(null);
        }}
        error={reasonError ?? undefined}
        helperText="Queda registrado en la trazabilidad de la anulación."
      />

      {serverError ? (
        <p role="alert" className="text-sm text-error">
          {serverError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          variant="text"
          type="button"
          disabled={voidSale.isPending}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          variant="danger"
          type="submit"
          loading={voidSale.isPending}
          disabled={voidSale.isPending}
        >
          Anular venta
        </Button>
      </div>
    </form>
  );
}

export interface VoidSaleDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly saleId: string;
  readonly onVoided?: (sale: SaleDetail) => void;
}

export function VoidSaleDialog({
  open,
  onOpenChange,
  saleId,
  onVoided,
}: VoidSaleDialogProps): ReactNode {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Anular venta"
      description="La anulación restaura el stock y deja la venta fuera de los indicadores."
    >
      <VoidForm
        saleId={saleId}
        onCancel={() => {
          onOpenChange(false);
        }}
        onVoided={onVoided}
      />
    </Dialog>
  );
}
