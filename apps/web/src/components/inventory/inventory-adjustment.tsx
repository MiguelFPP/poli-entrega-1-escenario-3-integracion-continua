'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { ProductPicker } from '@/components/inventory/product-picker';
import {
  Button,
  Dialog,
  Select,
  TextArea,
  TextField,
  useSnackbar,
} from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { extractErrorMessage } from '@/lib/api-client';
import { useCreateMovement } from '@/lib/inventory';
import type { MovementPayload } from '@/lib/inventory';

export const movementFormSchema = z
  .object({
    type: z.enum(['ENTRY', 'ADJUSTMENT']),
    productId: z
      .string()
      .trim()
      .min(1, 'Selecciona un producto')
      .pipe(z.uuidv4('El producto no es válido')),
    quantity: z
      .string()
      .trim()
      .min(1, 'La cantidad es obligatoria')
      .refine(
        (value) => /^-?\d+$/.test(value),
        'La cantidad debe ser un número entero',
      )
      .transform((value) => Number(value))
      .refine((value) => value !== 0, 'La cantidad no puede ser 0'),
    unitCost: z
      .string()
      .trim()
      .refine(
        (value) => value.length === 0 || Number.isFinite(Number(value)),
        'El costo unitario debe ser un número',
      )
      .transform((value) => (value.length > 0 ? Number(value) : undefined))
      .refine(
        (value) => value === undefined || value >= 0,
        'El costo unitario debe ser mayor o igual a 0',
      ),
    reason: z
      .string()
      .trim()
      .max(255, 'El motivo no puede superar 255 caracteres'),
  })
  .superRefine((values, ctx) => {
    if (values.type === 'ENTRY' && values.quantity <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['quantity'],
        message: 'La cantidad debe ser mayor que 0',
      });
    }

    const reason = (values.reason ?? '').trim();
    if (values.type === 'ADJUSTMENT' && reason.length < 3) {
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'El motivo debe tener al menos 3 caracteres',
      });
    }
  });

export type MovementFormValues = z.input<typeof movementFormSchema>;
export type MovementFormOutput = z.output<typeof movementFormSchema>;

const TYPE_OPTIONS: readonly SelectOption[] = [
  { value: 'ENTRY', label: 'Entrada de mercancía' },
  { value: 'ADJUSTMENT', label: 'Ajuste de inventario' },
];

function defaultValues(): MovementFormValues {
  return {
    type: 'ENTRY',
    productId: '',
    quantity: '',
    unitCost: '',
    reason: '',
  };
}

/** Payload de la API: el costo solo aplica a las entradas. */
function toPayload(values: MovementFormOutput): MovementPayload {
  return {
    productId: values.productId,
    type: values.type,
    quantity: values.quantity,
    unitCost: values.type === 'ENTRY' ? values.unitCost : undefined,
    reason: values.reason.length > 0 ? values.reason : undefined,
  };
}

interface MovementFormProps {
  readonly onSaved: () => void;
  readonly onCancel: () => void;
}

/** El formulario vive dentro del diálogo: se monta de nuevo en cada apertura. */
function MovementForm({ onSaved, onCancel }: MovementFormProps): ReactNode {
  const formId = useId();
  const [serverError, setServerError] = useState<string | null>(null);

  const createMovement = useCreateMovement();
  const snackbar = useSnackbar();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MovementFormValues, unknown, MovementFormOutput>({
    resolver: zodResolver(movementFormSchema),
    defaultValues: defaultValues(),
  });

  const type = useWatch({ control, name: 'type' });
  const pending = isSubmitting || createMovement.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      await createMovement.mutateAsync(toPayload(values));
      snackbar.show('Movimiento registrado.');
      reset();
      onSaved();
    } catch (error) {
      setServerError(extractErrorMessage(error));
    }
  });

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <Select
            id={`${formId}-type`}
            label="Tipo de movimiento"
            options={TYPE_OPTIONS}
            value={field.value}
            onValueChange={field.onChange}
            disabled={pending}
            error={errors.type?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="productId"
        render={({ field }) => (
          <ProductPicker
            label="Producto"
            value={field.value}
            onChange={field.onChange}
            disabled={pending}
            error={errors.productId?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="quantity"
        render={({ field }) => (
          <TextField
            id={`${formId}-quantity`}
            label="Cantidad"
            type="number"
            inputMode="numeric"
            step={1}
            required
            placeholder="10"
            disabled={pending}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            helperText="En los ajustes usa negativos para registrar mermas."
            error={errors.quantity?.message}
          />
        )}
      />

      {type === 'ENTRY' ? (
        <Controller
          control={control}
          name="unitCost"
          render={({ field }) => (
            <TextField
              id={`${formId}-unitCost`}
              label="Costo unitario (COP)"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="1200"
              disabled={pending}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              helperText="Si lo omites se usa el costo actual del producto."
              error={errors.unitCost?.message}
            />
          )}
        />
      ) : null}

      <Controller
        control={control}
        name="reason"
        render={({ field }) => (
          <TextArea
            id={`${formId}-reason`}
            label="Motivo"
            required={type === 'ADJUSTMENT'}
            placeholder={
              type === 'ADJUSTMENT'
                ? 'Merma por vencimiento'
                : 'Compra al proveedor'
            }
            disabled={pending}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.reason?.message}
          />
        )}
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
          disabled={pending}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="submit" loading={pending} disabled={pending}>
          Registrar movimiento
        </Button>
      </div>
    </form>
  );
}

export interface InventoryAdjustmentProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function InventoryAdjustment({
  open,
  onOpenChange,
}: InventoryAdjustmentProps): ReactNode {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo movimiento de inventario"
      description="Una entrada suma unidades y puede actualizar el costo; un ajuste corrige el stock y admite cantidades negativas para las mermas."
    >
      <MovementForm
        onSaved={() => {
          onOpenChange(false);
        }}
        onCancel={() => {
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}
