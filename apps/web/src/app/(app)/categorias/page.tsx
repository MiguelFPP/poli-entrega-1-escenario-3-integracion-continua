'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { CategoryDialog } from '@/components/categories/category-dialog';
import {
  Button,
  Chip,
  EmptyState,
  Icon,
  Skeleton,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { extractErrorMessage } from '@/lib/api-client';
import { useCategories, useDeactivateCategory } from '@/lib/catalog';
import type { Category } from '@/lib/catalog';

const SKELETON_ROWS = 4;

export default function CategoriesPage(): ReactNode {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const categoriesQuery = useCategories();
  const deactivateCategory = useDeactivateCategory();

  const categories = categoriesQuery.data ?? [];

  const openCreate = (): void => {
    setEditing(undefined);
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (category: Category): void => {
    setEditing(category);
    setError(null);
    setDialogOpen(true);
  };

  const handleDeactivate = (category: Category): void => {
    setError(null);
    deactivateCategory.mutate(category.id, {
      onError: (mutationError) => {
        setError(extractErrorMessage(mutationError));
      },
    });
  };

  const renderRows = (): ReactNode => {
    if (categoriesQuery.isLoading) {
      return (
        <div
          role="status"
          aria-label="Cargando categorías"
          className="flex flex-col gap-4 rounded-3xl border border-outline-variant bg-surface p-4"
        >
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div key={index} className="flex items-center gap-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      );
    }

    if (categoriesQuery.isError) {
      return (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-3xl border border-error bg-surface-container-low p-6"
        >
          <h2 className="text-base font-semibold text-on-surface">
            No se pudieron cargar las categorías
          </h2>
          <p className="text-sm text-on-surface-variant">
            {extractErrorMessage(categoriesQuery.error)}
          </p>
          <Button
            variant="outlined"
            onClick={() => {
              void categoriesQuery.refetch();
            }}
          >
            Reintentar
          </Button>
        </div>
      );
    }

    if (categories.length === 0) {
      return (
        <EmptyState
          icon={<Icon name="categories" />}
          title="No hay categorías"
          description="Crea la primera categoría para agrupar los productos del catálogo."
          action={
            <Button variant="outlined" onClick={openCreate}>
              Nueva categoría
            </Button>
          }
        />
      );
    }

    return (
      <Table>
        <TableCaption>Listado de categorías del catálogo</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Productos</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => (
            <TableRow key={category.id}>
              <TableCell className="font-medium text-on-surface">
                {category.name}
              </TableCell>
              <TableCell>{category.description ?? '—'}</TableCell>
              <TableCell>{category.productCount}</TableCell>
              <TableCell>
                <Chip
                  label={category.active ? 'Activa' : 'Inactiva'}
                  variant={category.active ? 'assist' : 'filter'}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="text"
                    aria-label={`Editar ${category.name}`}
                    onClick={() => {
                      openEdit(category);
                    }}
                  >
                    Editar
                  </Button>
                  {category.active ? (
                    <Button
                      size="sm"
                      variant="text"
                      aria-label={`Desactivar ${category.name}`}
                      disabled={
                        deactivateCategory.isPending &&
                        deactivateCategory.variables === category.id
                      }
                      onClick={() => {
                        handleDeactivate(category);
                      }}
                    >
                      Desactivar
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-on-surface">Categorías</h1>
          <p className="text-sm text-on-surface-variant">
            Grupos del catálogo: solo las activas admiten productos nuevos.
          </p>
        </div>
        <Button onClick={openCreate}>Nueva categoría</Button>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}

      {renderRows()}

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editing}
      />
    </section>
  );
}
