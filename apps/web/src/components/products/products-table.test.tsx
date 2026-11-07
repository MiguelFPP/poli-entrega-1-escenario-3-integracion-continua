import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryProvider } from '@/components/providers/query-provider';
import { SnackbarProvider } from '@/components/ui';
import { ApiError } from '@/lib/api-client';
import type {
  Category,
  Paginated,
  PaginationMeta,
  Product,
  ProductQuery,
} from '@/lib/catalog';
import { formatCurrency } from '@/lib/format';
import { ProductsTable } from './products-table';

vi.mock('@/lib/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog')>();
  return {
    ...actual,
    useProducts: vi.fn(),
    useCategories: vi.fn(),
  };
});

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return { ...actual, apiFetch: vi.fn() };
});

const { useProducts, useCategories } = await import('@/lib/catalog');

const productsMock = vi.mocked(useProducts);
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

const PRODUCT: Product = {
  id: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
  sku: 'BEB-001',
  barcode: '7701000000011',
  name: 'Agua Cristal 600 ml',
  description: null,
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

const LOW_STOCK_PRODUCT: Product = {
  ...PRODUCT,
  id: '8a1f2e3d-4c5b-4a6f-9e0d-1c2b3a4d5e6f',
  sku: 'BEB-002',
  name: 'Gaseosa 1.5 L',
  stock: 3,
  minStock: 5,
  lowStock: true,
};

function paginated(
  products: Product[],
  meta: Partial<PaginationMeta> = {},
): Paginated<Product> {
  return {
    data: products,
    meta: {
      page: 1,
      pageSize: 20,
      total: products.length,
      totalPages: products.length > 0 ? 1 : 0,
      hasNextPage: false,
      hasPreviousPage: false,
      ...meta,
    },
  };
}

type ProductsResult = ReturnType<typeof useProducts>;
type CategoriesResult = ReturnType<typeof useCategories>;

function productsResult(
  overrides: Partial<ProductsResult> = {},
): ProductsResult {
  const base: Partial<ProductsResult> = {
    data: undefined,
    error: null,
    isLoading: false,
    isError: false,
  };
  return { ...base, ...overrides } as ProductsResult;
}

function categoriesResult(
  overrides: Partial<CategoriesResult> = {},
): CategoriesResult {
  const base: Partial<CategoriesResult> = {
    data: [],
    error: null,
    isLoading: false,
    isError: false,
  };
  return { ...base, ...overrides } as CategoriesResult;
}

/** El normalizador de Testing Library colapsa los espacios; el precio usa NBSP. */
function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function renderTable(
  query: ProductQuery = { page: 1 },
  onQueryChange: (next: ProductQuery) => void = vi.fn(),
) {
  return render(
    <QueryProvider>
      <SnackbarProvider>
        <ProductsTable query={query} onQueryChange={onQueryChange} />
      </SnackbarProvider>
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
  productsMock.mockReset();
  categoriesMock.mockReset();
  categoriesMock.mockReturnValue(categoriesResult({ data: [CATEGORY] }));
});

describe('ProductsTable', () => {
  it('renderiza las filas con los datos del producto', () => {
    productsMock.mockReturnValue(
      productsResult({ data: paginated([PRODUCT]) }),
    );

    renderTable();

    expect(screen.getByText('BEB-001')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Agua Cristal 600 ml' }),
    ).toHaveAttribute('href', `/productos/${PRODUCT.id}`);
    expect(
      screen.getByText(normalizeText(formatCurrency(PRODUCT.salePrice))),
    ).toBeInTheDocument();
    expect(screen.getByText(String(PRODUCT.stock))).toBeInTheDocument();
    expect(screen.getByText('Bebidas')).toBeInTheDocument();
  });

  it('muestra el chip de stock bajo cuando el producto lo requiere', () => {
    productsMock.mockReturnValue(
      productsResult({ data: paginated([LOW_STOCK_PRODUCT]) }),
    );

    renderTable();

    expect(screen.getByText('Stock bajo')).toBeInTheDocument();
  });

  it('muestra el estado vacío cuando no hay productos', () => {
    productsMock.mockReturnValue(productsResult({ data: paginated([]) }));

    renderTable();

    expect(
      screen.getByRole('heading', { name: 'No hay productos' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Limpiar filtros' }),
    ).toBeInTheDocument();
  });

  it('muestra los esqueletos mientras cargan los productos', () => {
    productsMock.mockReturnValue(productsResult({ isLoading: true }));

    renderTable();

    expect(
      screen.getByRole('status', { name: 'Cargando productos' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('muestra el mensaje de error y permite reintentar', () => {
    productsMock.mockReturnValue(
      productsResult({
        isError: true,
        error: new ApiError('Ocurrió un error interno en el servidor.', 500, {
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'No se pudieron cargar los productos',
        }),
      }),
    );

    renderTable();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('No se pudieron cargar los productos');
    expect(
      screen.getByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument();
  });

  it('habilita y deshabilita la paginación según los metadatos', () => {
    productsMock.mockReturnValue(
      productsResult({
        data: paginated([PRODUCT], {
          page: 1,
          total: 45,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: false,
        }),
      }),
    );

    renderTable();

    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(
      screen.getByText('Página 1 de 3 · 45 resultados'),
    ).toBeInTheDocument();
  });

  it('reinicia la página a 1 al cambiar un filtro', async () => {
    const onQueryChange = vi.fn();
    productsMock.mockReturnValue(
      productsResult({ data: paginated([PRODUCT]) }),
    );

    renderTable({ page: 3 }, onQueryChange);

    fireEvent.click(screen.getByRole('combobox', { name: 'Categoría' }));
    fireEvent.click(screen.getByRole('option', { name: 'Bebidas' }));

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: CATEGORY.id, page: 1 }),
    );
  });

  it('aplica la búsqueda con retardo y reinicia la página a 1', async () => {
    const onQueryChange = vi.fn();
    productsMock.mockReturnValue(
      productsResult({ data: paginated([PRODUCT]) }),
    );

    renderTable({ page: 3 }, onQueryChange);

    fireEvent.change(screen.getByLabelText('Buscar'), {
      target: { value: 'agua' },
    });

    await waitFor(
      () => {
        expect(onQueryChange).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'agua', page: 1 }),
        );
      },
      { timeout: 2000 },
    );
  });
});
