'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Checkbox, Dialog, TextArea, TextField } from '@/components/ui';
import { extractErrorMessage } from '@/lib/api-client';
import { useCreateCategory, useUpdateCategory } from '@/lib/catalog';
import type { Category } from '@/lib/catalog';

export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(80, 'El nombre no puede superar 80 caracteres'),
  description: z
    .string()
    .trim()
    .max(255, 'La descripción no puede superar 255 caracteres')
    .transform((value) => (value.length > 0 ? value : undefined)),
  active: z.boolean(),
});

type CategoryFormValues = z.input<typeof categoryFormSchema>;
type CategoryFormOutput = z.output<typeof categoryFormSchema>;

function defaultValues(category?: Category): CategoryFormValues {
  return {
    name: category?.name ?? '',
    description: category?.description ?? '',
    active: category?.active ?? true,
  };
}

interface CategoryFormProps {
  readonly category?: Category;
  readonly onSaved?: (category: Category) => void;
  readonly onCancel: () => void;
}

/** El formulario vive dentro del diálogo: se monta de nuevo en cada apertura. */
function CategoryForm({
  category,
  onSaved,
  onCancel,
}: CategoryFormProps): ReactNode {
  const formId = useId();
  const [serverError, setServerError] = useState<string | null>(null);

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues, unknown, CategoryFormOutput>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: defaultValues(category),
  });

  const isEditing = category !== undefined;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      const saved = isEditing
        ? await updateCategory.mutateAsync({
            id: category.id,
            payload: {
              name: values.name,
              description: values.description,
              active: values.active,
            },
          })
        : await createCategory.mutateAsync({
            name: values.name,
            description: values.description,
            active: values.active,
          });

      onSaved?.(saved);
    } catch (error) {
      setServerError(extractErrorMessage(error));
    }
  });

  const pending =
    isSubmitting || createCategory.isPending || updateCategory.isPending;

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextField
            id={`${formId}-name`}
            label="Nombre"
            required
            placeholder="Bebidas"
            disabled={pending}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.name?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <TextArea
            id={`${formId}-description`}
            label="Descripción"
            placeholder="Bebidas frías y calientes"
            disabled={pending}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.description?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="active"
        render={({ field }) => (
          <Checkbox
            id={`${formId}-active`}
            label="Categoría activa"
            helperText="Las categorías inactivas no admiten productos nuevos."
            disabled={pending}
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
        <Button
          variant="text"
          type="button"
          disabled={pending}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="submit" loading={pending} disabled={pending}>
          {isEditing ? 'Guardar cambios' : 'Crear categoría'}
        </Button>
      </div>
    </form>
  );
}

export interface CategoryDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly category?: Category;
  readonly onSaved?: (category: Category) => void;
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  onSaved,
}: CategoryDialogProps): ReactNode {
  const isEditing = category !== undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Editar categoría' : 'Nueva categoría'}
      description={
        isEditing
          ? 'Modifica el nombre, la descripción o el estado de la categoría.'
          : 'Crea una categoría para agrupar los productos del catálogo.'
      }
    >
      <CategoryForm
        key={category?.id ?? 'nueva'}
        category={category}
        onSaved={(saved) => {
          onOpenChange(false);
          onSaved?.(saved);
        }}
        onCancel={() => {
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}
