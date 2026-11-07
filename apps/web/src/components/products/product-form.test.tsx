import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import type { Category, Product } from '@/lib/catalog';
import { ProductForm } from './product-form';

vi.mock('@/lib/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog')>();
  return {
    ...actual,
    useCategories: vi.fn(),
    useCreateProduct: vi.fn(),
    useUpdateProduct: vi.fn(),
  };
});

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return { ...actual, apiFetch: vi.fn() };
});

const { useCategories, useCreateProduct, useUpdateProduct } = await import(
  '@/lib/catalog'
);

const categoriesMock = vi.mocked(useCategories);
const createProductMock = vi.mocked(useCreateProduct);
const updateProductMock = vi.mocked(useUpdateProduct);

const CATEGORY: Category = {
  id: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
  name: 'Bebidas',
  description: null,
  active: true,
  productCount: 2,
  createdAt: '2026-02-10T14:30:00.000Z',
  updatedAt: '2026-02-12T09:15:00.000Z',
};

const PRODUCT: Product = {
  id: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
  sku: 'BEB-001',
  barcode: '7701000000011',
  name: 'Agua Cristal 600 ml',
  description: 'Agua purificada sin gas',
  categoryId: CATEGORY.id,
  category: { id: CATEGORY.id, name: CATEGORY.name },
  costPrice: 1200,
  salePrice: 2000,
  stock: 96,
  minStock: 24,
  unit: 'botella',
  imageUrl: null,
  active: true,
  lowStock: false,
  createdAt: '2026-02-10T14:30:00.000Z',
  updatedAt: '2026-02-12T09:15:00.000Z',
};

function categoriesResult(data: Category[] = [CATEGORY]) {
  return {
    data,
    error: null,
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useCategories>;
}

function mutationResult<T>(overrides: Record<string, unknown> = {}) {
  return {
    mutateAsync: vi.fn().mockResolvedValue(PRODUCT),
    isPending: false,
    ...overrides,
  } as unknown as T;
}

/** Elige la categoría en el desplegable de Radix. */
function selectCategory(): void {
  fireEvent.click(screen.getByRole('combobox', { name: 'Categoría' }));
  fireEvent.click(
    screen.getByRole('option', {
      name: `${CATEGORY.name} (${CATEGORY.productCount} productos)`,
    }),
  );
}

/** Rellena los campos obligatorios de un producto nuevo. */
function fillRequiredFields(): void {
  fireEvent.change(screen.getByLabelText(/SKU/), {
    target: { value: 'BEB-001' },
  });
  fireEvent.change(screen.getByLabelText(/Nombre/), {
    target: { value: 'Agua Cristal 600 ml' },
  });
  fireEvent.change(screen.getByLabelText(/Costo/), {
    target: { value: '1200' },
  });
  fireEvent.change(screen.getByLabelText(/Precio de venta/), {
    target: { value: '2000' },
  });
  selectCategory();
}

beforeAll(() => {
  // jsdom no implementa las APIs que Radix usa para posicionar el desplegable.
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;

  Element.prototype.scrollIntoView ??= vi.fn();
});

beforeEach(() => {
  categoriesMock.mockReset();
  createProductMock.mockReset();
  updateProductMock.mockReset();

  categoriesMock.mockReturnValue(categoriesResult());
  createProductMock.mockReturnValue(
    mutationResult<ReturnType<typeof useCreateProduct>>(),
  );
  updateProductMock.mockReturnValue(
    mutationResult<ReturnType<typeof useUpdateProduct>>(),
  );
});

describe('ProductForm', () => {
  it('muestra los mensajes de validación en español al enviar vacío', async () => {
    render(<ProductForm mode="create" />);

    fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }));

    expect(
      await screen.findByText('El SKU debe tener al menos 2 caracteres'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('El nombre debe tener al menos 2 caracteres'),
    ).toBeInTheDocument();
    expect(screen.getByText('Selecciona una categoría')).toBeInTheDocument();
    expect(screen.getByText('El costo es obligatorio')).toBeInTheDocument();
    expect(
      screen.getByText('El precio de venta es obligatorio'),
    ).toBeInTheDocument();
  });

  it('precarga los valores del producto en modo edición', () => {
    render(<ProductForm mode="edit" product={PRODUCT} />);

    expect(screen.getByLabelText(/SKU/)).toHaveValue(PRODUCT.sku);
    expect(screen.getByLabelText(/Código de barras/)).toHaveValue(
      PRODUCT.barcode,
    );
    expect(screen.getByLabelText(/Nombre/)).toHaveValue(PRODUCT.name);
    expect(screen.getByLabelText(/Descripción/)).toHaveValue(
      PRODUCT.description,
    );
    expect(screen.getByLabelText(/Costo/)).toHaveValue(PRODUCT.costPrice);
    expect(screen.getByLabelText(/Precio de venta/)).toHaveValue(
      PRODUCT.salePrice,
    );
    expect(screen.getByLabelText(/Stock mínimo/)).toHaveValue(PRODUCT.minStock);
    expect(screen.getByLabelText(/Unidad/)).toHaveValue(PRODUCT.unit);
    expect(
      screen.getByRole('checkbox', { name: 'Producto activo' }),
    ).toBeChecked();
  });

  it('envía el payload sin stock y con los campos vacíos como undefined', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(PRODUCT);
    createProductMock.mockReturnValue(
      mutationResult<ReturnType<typeof useCreateProduct>>({ mutateAsync }),
    );

    render(<ProductForm mode="create" />);

    fireEvent.change(screen.getByLabelText(/SKU/), {
      target: { value: 'BEB-002' },
    });
    fireEvent.change(screen.getByLabelText(/Nombre/), {
      target: { value: 'Gaseosa 1.5 L' },
    });
    fireEvent.change(screen.getByLabelText(/Costo/), {
      target: { value: '1800' },
    });
    fireEvent.change(screen.getByLabelText(/Precio de venta/), {
      target: { value: '3000' },
    });
    selectCategory();

    fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });

    const payload = mutateAsync.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(payload).not.toHaveProperty('stock');
    expect(payload.barcode).toBeUndefined();
    expect(payload.description).toBeUndefined();
    expect(payload.imageUrl).toBeUndefined();
    expect(payload.sku).toBe('BEB-002');
    expect(payload.costPrice).toBe(1800);
    expect(payload.salePrice).toBe(3000);
    expect(payload.minStock).toBe(0);
    expect(payload.unit).toBe('unidad');
  });

  it('muestra el mensaje de la API cuando el SKU ya existe', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(
      new ApiError('La operación entra en conflicto', 409, {
        statusCode: 409,
        error: 'Conflict',
        message: 'Ya existe un producto con ese SKU',
      }),
    );
    createProductMock.mockReturnValue(
      mutationResult<ReturnType<typeof useCreateProduct>>({ mutateAsync }),
    );

    render(<ProductForm mode="create" />);

    fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Ya existe un producto con ese SKU');
  });

  it('enfoca el primer campo con error al enviar vacío', async () => {
    render(<ProductForm mode="create" />);

    fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }));

    await screen.findByText('El SKU debe tener al menos 2 caracteres');
    expect(document.activeElement?.id).toContain('sku');
  });

  it('llama a onSuccess con el producto guardado', async () => {
    const onSuccess = vi.fn();
    const mutateAsync = vi.fn().mockResolvedValue(PRODUCT);
    createProductMock.mockReturnValue(
      mutationResult<ReturnType<typeof useCreateProduct>>({ mutateAsync }),
    );

    render(<ProductForm mode="create" onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/SKU/), {
      target: { value: 'BEB-002' },
    });
    fireEvent.change(screen.getByLabelText(/Nombre/), {
      target: { value: 'Gaseosa 1.5 L' },
    });
    fireEvent.change(screen.getByLabelText(/Costo/), {
      target: { value: '1800' },
    });
    fireEvent.change(screen.getByLabelText(/Precio de venta/), {
      target: { value: '3000' },
    });
    selectCategory();

    fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(PRODUCT);
    });
  });
});
