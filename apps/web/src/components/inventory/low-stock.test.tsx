import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryProvider } from '@/components/providers/query-provider';
import { ApiError } from '@/lib/api-client';
import type { Category, Paginated, PaginationMeta } from '@/lib/catalog';
import { formatCurrency } from '@/lib/format';
import type { LowStockItem } from '@/lib/inventory';
import { LowStock } from './low-stock';

vi.mock('@/lib/inventory', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/inventory')>();
  return { ...actual, useLowStock: vi.fn() };
});

vi.mock('@/lib/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog')>();
  return { ...actual, useCategories: vi.fn() };
});

const { useLowStock } = await import('@/lib/inventory');
const { useCategories } = await import('@/lib/catalog');

const lowStockMock = vi.mocked(useLowStock);
const categoriesMock = vi.mocked(useCategories);

const CATEGORY: Category = {
  id: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
  name: 'Bebidas',
  description: null,
  active: true,
  productCount: 2,
  createdAt: '2026-02-10T14:30:00.000Z',
  updatedAt: '2026-02-12T09:15:00.000Z',
};

const ITEM: LowStockItem = {
  id: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
  sku: 'BEB-001',
  name: 'Agua Cristal 600 ml',
  category: { id: CATEGORY.id, name: CATEGORY.name },
  stock: 3,
  minStock: 12,
  unit: 'botella',
  deficit: 9,
  costPrice: 1500,
  inventoryValue: 4500,
  lowStock: true,
};

function paginated(
  items: LowStockItem[],
  meta: Partial<PaginationMeta> = {},
): Paginated<LowStockItem> {
  return {
    data: items,
    meta: {
      page: 1,
      pageSize: 20,
      total: items.length,
      totalPages: items.length > 0 ? 1 : 0,
      hasNextPage: false,
      hasPreviousPage: false,
      ...meta,
    },
  };
}

type LowStockResult = ReturnType<typeof useLowStock>;
type CategoriesResult = ReturnType<typeof useCategories>;

function lowStockResult(
  overrides: Partial<LowStockResult> = {},
): LowStockResult {
  const base: Partial<LowStockResult> = {
    data: undefined,
    error: null,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
  return { ...base, ...overrides } as LowStockResult;
}

function categoriesResult(
  overrides: Partial<CategoriesResult> = {},
): CategoriesResult {
  const base: Partial<CategoriesResult> = {
    data: [CATEGORY],
    error: null,
    isLoading: false,
    isError: false,
  };
  return { ...base, ...overrides } as CategoriesResult;
}

/** El normalizador de Testing Library colapsa los espacios; el importe usa NBSP. */
function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function renderLowStock() {
  return render(
    <QueryProvider>
      <LowStock />
    </QueryProvider>,
  );
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
  lowStockMock.mockReset();
  categoriesMock.mockReset();

  categoriesMock.mockReturnValue(categoriesResult());
  lowStockMock.mockReturnValue(
    lowStockResult({ data: paginated([ITEM]) }),
  );
});

describe('LowStock', () => {
  it('renderiza las filas con el déficit y la valorización', () => {
    renderLowStock();

    expect(screen.getByText('BEB-001')).toBeInTheDocument();
    expect(screen.getByText('Agua Cristal 600 ml')).toBeInTheDocument();
    expect(screen.getByText('Bebidas')).toBeInTheDocument();
    expect(screen.getByText(String(ITEM.stock))).toBeInTheDocument();
    expect(screen.getByText(String(ITEM.minStock))).toBeInTheDocument();
    expect(screen.getByText(String(ITEM.deficit))).toBeInTheDocument();
    expect(
      screen.getByText(normalizeText(formatCurrency(ITEM.inventoryValue))),
    ).toBeInTheDocument();
  });

  it('aplica la búsqueda con retardo y reinicia la página', async () => {
    renderLowStock();

    fireEvent.change(screen.getByLabelText('Buscar'), {
      target: { value: 'agua' },
    });

    await waitFor(
      () => {
        expect(lowStockMock).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: 'agua', page: 1 }),
        );
      },
      { timeout: 2000 },
    );
  });

  it('filtra por categoría y reinicia la página', () => {
    renderLowStock();

    fireEvent.click(screen.getByRole('combobox', { name: 'Categoría' }));
    fireEvent.click(screen.getByRole('option', { name: 'Bebidas' }));

    expect(lowStockMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ categoryId: CATEGORY.id, page: 1 }),
    );
  });

  it('limpia los filtros y conserva el tamaño de página', () => {
    renderLowStock();

    fireEvent.change(screen.getByLabelText('Buscar'), {
      target: { value: 'agua' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(lowStockMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
    expect(screen.getByLabelText('Buscar')).toHaveValue('');
  });

  it('muestra los esqueletos mientras carga el stock bajo', () => {
    lowStockMock.mockReturnValue(lowStockResult({ isLoading: true }));

    renderLowStock();

    expect(
      screen.getByRole('status', { name: 'Cargando stock bajo' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('muestra el error y permite reintentar', () => {
    const refetch = vi.fn();
    lowStockMock.mockReturnValue(
      lowStockResult({
        isError: true,
        error: new ApiError('Ocurrió un error interno en el servidor.', 500, {
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'No se pudo cargar el stock bajo',
        }),
        refetch,
      }),
    );

    renderLowStock();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo cargar el stock bajo',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('muestra el estado vacío cuando no hay stock bajo', () => {
    lowStockMock.mockReturnValue(lowStockResult({ data: paginated([]) }));

    renderLowStock();

    expect(
      screen.getByRole('heading', {
        name: 'No hay productos con stock bajo',
      }),
    ).toBeInTheDocument();
  });

  it('pagina con los metadatos recibidos', () => {
    lowStockMock.mockReturnValue(
      lowStockResult({
        data: paginated([ITEM], {
          page: 1,
          total: 45,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: false,
        }),
      }),
    );

    renderLowStock();

    expect(screen.getByText('Página 1 de 3 · 45 productos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(lowStockMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });
});
