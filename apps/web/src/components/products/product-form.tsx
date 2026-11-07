'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { FieldErrors } from 'react-hook-form';
import { z } from 'zod';
import { Button, Checkbox, Select, TextArea, TextField } from '@/components/ui';
import { extractErrorMessage } from '@/lib/api-client';
import {
  useCategories,
  useCreateProduct,
  useUpdateProduct,
} from '@/lib/catalog';
import type { Product } from '@/lib/catalog';

/** Importe máximo soportado por la API (`Decimal(14, 2)`). */
const MAX_MONEY = 999_999_999_999.99;

/** Campos que se limpian: cadena vacía equivale a `undefined`. */
const emptyToUndefined = (value: string): string | undefined =>
  value.length > 0 ? value : undefined;

/** Importe en COP: obligatorio, no negativo y con máximo 2 decimales. */
const moneySchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} es obligatorio`)
    .refine(
      (value) => Number.isFinite(Number(value)),
      `${label} debe ser un número`,
    )
    .transform((value) => Number(value))
    .refine((value) => value >= 0, `${label} debe ser mayor o igual a 0`)
    .refine(
      (value) => value <= MAX_MONEY,
      `${label} no puede superar el máximo permitido`,
    )
    .refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
      `${label} debe tener máximo 2 decimales`,
    );

export const productFormSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(2, 'El SKU debe tener al menos 2 caracteres')
    .max(64, 'El SKU no puede superar 64 caracteres'),
  barcode: z
    .string()
    .trim()
    .max(64, 'El código de barras no puede superar 64 caracteres')
    .refine(
      (value) => value.length === 0 || value.length >= 4,
      'El código de barras debe tener al menos 4 caracteres',
    )
    .refine(
      (value) => value.length === 0 || /^[A-Za-z0-9._-]+$/.test(value),
      'El código de barras solo admite letras, números, punto, guion y guion bajo',
    )
    .transform(emptyToUndefined),
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(160, 'El nombre no puede superar 160 caracteres'),
  description: z
    .string()
    .trim()
    .max(500, 'La descripción no puede superar 500 caracteres')
    .transform(emptyToUndefined),
  categoryId: z
    .string()
    .trim()
    .min(1, 'Selecciona una categoría')
    .pipe(z.uuidv4('La categoría no es válida')),
  costPrice: moneySchema('El costo'),
  salePrice: moneySchema('El precio de venta'),
  minStock: z
    .string()
    .trim()
    .min(1, 'El stock mínimo es obligatorio')
    .refine(
      (value) => /^\d+$/.test(value),
      'El stock mínimo debe ser un número entero',
    )
    .transform(Number),
  unit: z
    .string()
    .trim()
    .min(1, 'La unidad es obligatoria')
    .max(32, 'La unidad no puede superar 32 caracteres'),
  imageUrl: z
    .string()
    .trim()
    .max(500, 'La URL de la imagen no puede superar 500 caracteres')
    .refine(
      (value) => value.length === 0 || /^https?:\/\/\S+$/i.test(value),
      'La URL de la imagen debe ser una URL http o https',
    )
    .transform(emptyToUndefined),
  active: z.boolean(),
});

export type ProductFormValues = z.input<typeof productFormSchema>;
export type ProductFormOutput = z.output<typeof productFormSchema>;

/** Orden de los campos: define el foco del primer error. */
const FIELD_ORDER = [
  'sku',
  'barcode',
  'name',
  'description',
  'categoryId',
  'costPrice',
  'salePrice',
  'minStock',
  'unit',
  'imageUrl',
  'active',
] as const satisfies readonly (keyof ProductFormValues)[];

function defaultValues(
  mode: 'create' | 'edit',
  product?: Product,
): ProductFormValues {
  if (mode === 'edit' && product) {
    return {
      sku: product.sku,
      barcode: product.barcode ?? '',
      name: product.name,
      description: product.description ?? '',
      categoryId: product.categoryId,
      costPrice: String(product.costPrice),
      salePrice: String(product.salePrice),
      minStock: String(product.minStock),
      unit: product.unit,
      imageUrl: product.imageUrl ?? '',
      active: product.active,
    };
  }

  return {
    sku: '',
    barcode: '',
    name: '',
    description: '',
    categoryId: '',
    costPrice: '',
    salePrice: '',
    minStock: '0',
    unit: 'unidad',
    imageUrl: '',
    active: true,
  };
}

/** Payload de la API: nunca incluye `stock` (lo gestiona el inventario). */
function toPayload(values: ProductFormOutput) {
  return {
    sku: values.sku,
    barcode: values.barcode,
    name: values.name,
    description: values.description,
    categoryId: values.categoryId,
    costPrice: values.costPrice,
    salePrice: values.salePrice,
    minStock: values.minStock,
    unit: values.unit,
    imageUrl: values.imageUrl,
    active: values.active,
  };
}

export interface ProductFormProps {
  readonly mode: 'create' | 'edit';
  readonly product?: Product;
  readonly onSuccess?: (product: Product) => void;
}

export function ProductForm({
  mode,
  product,
  onSuccess,
}: ProductFormProps): ReactNode {
  const formId = useId();
  const [serverError, setServerError] = useState<string | null>(null);

  const categoriesQuery = useCategories({ active: 'true' });
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues, unknown, ProductFormOutput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: defaultValues(mode, product),
  });

  const fieldId = (name: string): string => `${formId}-${name}`;

  const focusFirstError = (
    fieldErrors: FieldErrors<ProductFormValues>,
  ): void => {
    const first = FIELD_ORDER.find((name) => fieldErrors[name]);
    if (!first) {
      return;
    }
    document.getElementById(fieldId(first))?.focus();
  };

  const onSubmit = handleSubmit(
    async (values) => {
      setServerError(null);
      const payload = toPayload(values);

      try {
        const saved =
          mode === 'create'
            ? await createProduct.mutateAsync(payload)
            : await updateProduct.mutateAsync({
                id: product?.id ?? '',
                payload,
              });

        onSuccess?.(saved);
      } catch (error) {
        setServerError(extractErrorMessage(error));
      }
    },
    (fieldErrors) => {
      focusFirstError(fieldErrors);
    },
  );

  const categoryOptions = (categoriesQuery.data ?? []).map((category) => ({
    value: category.id,
    label: `${category.name} (${category.productCount} productos)`,
  }));

  // Los campos solo se bloquean mientras la petición está en vuelo: si se
  // bloquearan durante la validación, `focus()` sobre el campo con error no
  // surte efecto porque un input deshabilitado no recibe el foco.
  const saving = createProduct.isPending || updateProduct.isPending;
  const pending = isSubmitting || saving;

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="flex flex-col gap-5 rounded-3xl bg-surface-container-low p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="sku"
          render={({ field }) => (
            <TextField
              id={fieldId('sku')}
              label="SKU"
              required
              autoComplete="off"
              placeholder="BEB-001"
              disabled={saving}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.sku?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="barcode"
          render={({ field }) => (
            <TextField
              id={fieldId('barcode')}
              label="Código de barras"
              autoComplete="off"
              placeholder="7701000000011"
              disabled={saving}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.barcode?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextField
              id={fieldId('name')}
              label="Nombre"
              required
              placeholder="Agua Cristal 600 ml"
              disabled={saving}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.name?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <Select
              id={fieldId('categoryId')}
              label="Categoría"
              options={categoryOptions}
              placeholder="Elige una categoría"
              helperText={
                categoriesQuery.isLoading
                  ? 'Cargando categorías…'
                  : 'Solo se admiten categorías activas.'
              }
              disabled={saving || categoriesQuery.isLoading}
              value={field.value}
              onValueChange={field.onChange}
              error={errors.categoryId?.message}
            />
          )}
        />
      </div>

      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <TextArea
            id={fieldId('description')}
            label="Descripción"
            placeholder="Agua purificada sin gas, botella de 600 ml"
            disabled={saving}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.description?.message}
          />
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="costPrice"
          render={({ field }) => (
            <TextField
              id={fieldId('costPrice')}
              label="Costo"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              required
              placeholder="1200"
              disabled={saving}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.costPrice?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="salePrice"
          render={({ field }) => (
            <TextField
              id={fieldId('salePrice')}
              label="Precio de venta"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              required
              placeholder="2000"
              disabled={saving}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.salePrice?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="minStock"
          render={({ field }) => (
            <TextField
              id={fieldId('minStock')}
              label="Stock mínimo"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              required
              helperText="Aviso de reposición; el stock real lo gestiona el inventario."
              disabled={saving}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.minStock?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="unit"
          render={({ field }) => (
            <TextField
              id={fieldId('unit')}
              label="Unidad"
              required
              placeholder="botella"
              disabled={saving}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.unit?.message}
            />
          )}
        />
      </div>

      <Controller
        control={control}
        name="imageUrl"
        render={({ field }) => (
          <TextField
            id={fieldId('imageUrl')}
            label="URL de la imagen"
            type="url"
            placeholder="https://cdn.pos.local/productos/agua.png"
            disabled={saving}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.imageUrl?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="active"
        render={({ field }) => (
          <Checkbox
            id={fieldId('active')}
            label="Producto activo"
            helperText="Los inactivos no aparecen en el catálogo."
            disabled={saving}
            checked={field.value}
            onChange={field.onChange}
          />
        )}
      />

      {serverError ? (
        <p role="alert" className="text-sm text-error">
          {serverError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button type="submit" loading={pending} disabled={pending}>
          {mode === 'create' ? 'Crear producto' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}
