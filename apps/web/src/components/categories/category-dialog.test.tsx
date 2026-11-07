import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import type { Category } from '@/lib/catalog';
import { CategoryDialog } from './category-dialog';

vi.mock('@/lib/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog')>();
  return {
    ...actual,
    useCreateCategory: vi.fn(),
    useUpdateCategory: vi.fn(),
  };
});

const { useCreateCategory, useUpdateCategory } = await import('@/lib/catalog');

const createCategoryMock = vi.mocked(useCreateCategory);
const updateCategoryMock = vi.mocked(useUpdateCategory);

const CATEGORY: Category = {
  id: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
  name: 'Bebidas',
  description: 'Bebidas frías y calientes',
  active: true,
  productCount: 2,
  createdAt: '2026-02-10T14:30:00.000Z',
  updatedAt: '2026-02-12T09:15:00.000Z',
};

function mutationResult<T>(overrides: Record<string, unknown> = {}) {
  return {
    mutateAsync: vi.fn().mockResolvedValue(CATEGORY),
    isPending: false,
    ...overrides,
  } as unknown as T;
}

beforeEach(() => {
  createCategoryMock.mockReset();
  updateCategoryMock.mockReset();

  createCategoryMock.mockReturnValue(
    mutationResult<ReturnType<typeof useCreateCategory>>(),
  );
  updateCategoryMock.mockReturnValue(
    mutationResult<ReturnType<typeof useUpdateCategory>>(),
  );
});

describe('CategoryDialog', () => {
  it('en modo crear muestra el botón "Crear categoría"', () => {
    render(<CategoryDialog open onOpenChange={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: 'Crear categoría' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Nueva categoría' }),
    ).toBeInTheDocument();
  });

  it('en modo editar muestra el botón "Guardar cambios" y el nombre precargado', () => {
    render(<CategoryDialog open onOpenChange={vi.fn()} category={CATEGORY} />);

    expect(
      screen.getByRole('button', { name: 'Guardar cambios' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre/)).toHaveValue(CATEGORY.name);
    expect(screen.getByLabelText(/Descripción/)).toHaveValue(
      CATEGORY.description,
    );
    expect(
      screen.getByRole('checkbox', { name: 'Categoría activa' }),
    ).toBeChecked();
  });

  it('muestra el mensaje de la API cuando el nombre ya existe', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(
      new ApiError('La operación entra en conflicto', 409, {
        statusCode: 409,
        error: 'Conflict',
        message: 'Ya existe una categoría con ese nombre',
      }),
    );
    createCategoryMock.mockReturnValue(
      mutationResult<ReturnType<typeof useCreateCategory>>({ mutateAsync }),
    );

    render(<CategoryDialog open onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Nombre/), {
      target: { value: 'Bebidas' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear categoría' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Ya existe una categoría con ese nombre');
  });

  it('muestra los mensajes de validación en español al enviar vacío', async () => {
    render(<CategoryDialog open onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Crear categoría' }));

    expect(
      await screen.findByText('El nombre debe tener al menos 2 caracteres'),
    ).toBeInTheDocument();
  });

  it('envía el payload con el nombre y la descripción introducidos', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(CATEGORY);
    const onOpenChange = vi.fn();
    createCategoryMock.mockReturnValue(
      mutationResult<ReturnType<typeof useCreateCategory>>({ mutateAsync }),
    );

    render(<CategoryDialog open onOpenChange={onOpenChange} />);

    fireEvent.change(screen.getByLabelText(/Nombre/), {
      target: { value: 'Snacks' },
    });
    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: 'Snacks de packaged' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear categoría' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });

    expect(mutateAsync).toHaveBeenCalledWith({
      name: 'Snacks',
      description: 'Snacks de packaged',
      active: true,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
