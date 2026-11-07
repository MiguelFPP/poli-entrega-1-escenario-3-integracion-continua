import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryProvider } from '@/components/providers/query-provider';
import { SnackbarProvider } from '@/components/ui';
import { ApiError } from '@/lib/api-client';
import type { Paginated, PaginationMeta, Product } from '@/lib/catalog';
import type { StockMovement } from '@/lib/inventory';
import { InventoryAdjustment } from './inventory-adjustment';

vi.mock('@/lib/inventory', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/inventory')>();
  return { ...actual, useCreateMovement: vi.fn() };
});

vi.mock('@/lib/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog')>();
  return { ...actual, useProducts: vi.fn() };
});

const { useCreateMovement } = await import('@/lib/inventory');
const { useProducts } = await import('@/lib/catalog');

const createMovementMock = vi.mocked(useCreateMovement);
const productsMock = vi.mocked(useProducts);

const PRODUCT: Product = {
  id: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
  sku: 'BEB-001',
  barcode: '7701000000011',
  name: 'Agua Cristal 600 ml',
  description: null,
  categoryId: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
  category: { id: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f', name: 'Bebidas' },
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

const MOVEMENT: StockMovement = {
  id: '3d4e5f6a-7b8c-4d9e-8f0a-1b2c3d4e5f6a',
  productId: PRODUCT.id,
  product: { id: PRODUCT.id, sku: PRODUCT.sku, name: PRODUCT.name },
  type: 'ENTRY',
  quantity: 10,
  previousStock: 96,
  newStock: 106,
  unitCost: 1200,
  reason: 'Compra al proveedor',
  saleId: null,
  user: null,
  createdAt: '2026-02-12T09:15:00.000Z',
};

function paginatedProducts(products: Product[]): Paginated<Product> {
  const meta: PaginationMeta = {
    page: 1,
    pageSize: 20,
    total: products.length,
    totalPages: products.length > 0 ? 1 : 0,
    hasNextPage: false,
    hasPreviousPage: false,
  };
  return { data: products, meta };
}

type ProductsResult = ReturnType<typeof useProducts>;

function productsResult(
  overrides: Partial<ProductsResult> = {},
): ProductsResult {
  const base: Partial<ProductsResult> = {
    data: paginatedProducts([PRODUCT]),
    error: null,
    isLoading: false,
    isError: false,
  };
  return { ...base, ...overrides } as ProductsResult;
}

function mutationResult<T>(overrides: Record<string, unknown> = {}): T {
  return {
    mutateAsync: vi.fn().mockResolvedValue(MOVEMENT),
    isPending: false,
    ...overrides,
  } as unknown as T;
}

function renderDialog(onOpenChange: (open: boolean) => void = vi.fn()) {
  return render(
    <QueryProvider>
      <SnackbarProvider>
        <InventoryAdjustment open onOpenChange={onOpenChange} />
      </SnackbarProvider>
    </QueryProvider>,
  );
}

function chooseProduct(): void {
  fireEvent.click(screen.getByRole('combobox', { name: 'Producto' }));
  fireEvent.click(
    screen.getByRole('option', { name: /Agua Cristal 600 ml/ }),
  );
}

function chooseType(name: string): void {
  fireEvent.click(
    screen.getByRole('combobox', { name: 'Tipo de movimiento' }),
  );
  fireEvent.click(screen.getByRole('option', { name }));
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
  createMovementMock.mockReset();
  productsMock.mockReset();

  createMovementMock.mockReturnValue(
    mutationResult<ReturnType<typeof useCreateMovement>>(),
  );
  productsMock.mockReturnValue(productsResult());
});

describe('InventoryAdjustment', () => {
  it('renderiza el diálogo con un movimiento de entrada por defecto', () => {
    renderDialog();

    expect(
      screen.getByRole('heading', {
        name: 'Nuevo movimiento de inventario',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Tipo de movimiento' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Producto' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Cantidad/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Costo unitario/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Motivo/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Registrar movimiento' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cancelar' }),
    ).toBeInTheDocument();
  });

  it('oculta el costo unitario al elegir un ajuste', () => {
    renderDialog();

    chooseType('Ajuste de inventario');

    expect(screen.queryByLabelText(/Costo unitario/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Cantidad/)).toBeInTheDocument();
  });

  it('rechaza una cantidad menor o igual a 0 en una entrada', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(MOVEMENT);
    createMovementMock.mockReturnValue(
      mutationResult<ReturnType<typeof useCreateMovement>>({ mutateAsync }),
    );

    renderDialog();

    chooseProduct();
    fireEvent.change(screen.getByLabelText(/Cantidad/), {
      target: { value: '-5' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Registrar movimiento' }),
    );

    expect(
      await screen.findByText('La cantidad debe ser mayor que 0'),
    ).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('exige el motivo en un ajuste', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(MOVEMENT);
    createMovementMock.mockReturnValue(
      mutationResult<ReturnType<typeof useCreateMovement>>({ mutateAsync }),
    );

    renderDialog();

    chooseType('Ajuste de inventario');
    chooseProduct();
    fireEvent.change(screen.getByLabelText(/Cantidad/), {
      target: { value: '-4' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Registrar movimiento' }),
    );

    expect(
      await screen.findByText('El motivo debe tener al menos 3 caracteres'),
    ).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('envía el payload de una entrada y cierra el diálogo', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(MOVEMENT);
    const onOpenChange = vi.fn();
    createMovementMock.mockReturnValue(
      mutationResult<ReturnType<typeof useCreateMovement>>({ mutateAsync }),
    );

    renderDialog(onOpenChange);

    chooseProduct();
    fireEvent.change(screen.getByLabelText(/Cantidad/), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText(/Costo unitario/), {
      target: { value: '1200' },
    });
    fireEvent.change(screen.getByLabelText(/Motivo/), {
      target: { value: 'Compra al proveedor' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Registrar movimiento' }),
    );

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });

    expect(mutateAsync).toHaveBeenCalledWith({
      productId: PRODUCT.id,
      type: 'ENTRY',
      quantity: 10,
      unitCost: 1200,
      reason: 'Compra al proveedor',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('muestra el error de la API cuando falta stock y mantiene el diálogo', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(
      new ApiError('La operación entra en conflicto con el estado actual.', 409, {
        statusCode: 409,
        error: 'Conflict',
        message: 'Stock insuficiente para registrar el ajuste',
      }),
    );
    createMovementMock.mockReturnValue(
      mutationResult<ReturnType<typeof useCreateMovement>>({ mutateAsync }),
    );

    renderDialog();

    chooseType('Ajuste de inventario');
    chooseProduct();
    fireEvent.change(screen.getByLabelText(/Cantidad/), {
      target: { value: '-40' },
    });
    fireEvent.change(screen.getByLabelText(/Motivo/), {
      target: { value: 'Merma por vencimiento' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Registrar movimiento' }),
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Stock insuficiente para registrar el ajuste',
    );
    expect(
      screen.getByRole('heading', { name: 'Nuevo movimiento de inventario' }),
    ).toBeInTheDocument();
  });
});
