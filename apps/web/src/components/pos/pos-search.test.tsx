import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryProvider } from '@/components/providers/query-provider';
import { ApiError } from '@/lib/api-client';
import type {
  Category,
  Paginated,
  PaginationMeta,
  Product,
} from '@/lib/catalog';
import { formatCurrency } from '@/lib/format';
import { PosSearch } from './pos-search';

vi.mock('@/lib/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog')>();
  return { ...actual, useProducts: vi.fn(), useCategories: vi.fn() };
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

const OUT_OF_STOCK: Product = {
  ...PRODUCT,
  id: '8a1f2e3d-4c5b-4a6f-9e0d-1c2b3a4d5e6f',
  sku: 'BEB-002',
  name: 'Gaseosa 1.5 L',
  stock: 0,
};

function paginated(
  products: Product[],
  meta: Partial<PaginationMeta> = {},
): Paginated<Product> {
  return {
    data: products,
    meta: {
      page: 1,
      pageSize: 50,
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
    data: paginated([PRODUCT]),
    error: null,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
  return { ...base, ...overrides } as ProductsResult;
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

/** El normalizador de Testing Library colapsa los espacios; el precio usa NBSP. */
function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function renderSearch(onAdd: (product: Product) => void = vi.fn()) {
  return render(
    <QueryProvider>
      <PosSearch onAdd={onAdd} />
    </QueryProvider>,
  );
}

beforeEach(() => {
  productsMock.mockReset();
  categoriesMock.mockReset();

  productsMock.mockReturnValue(productsResult());
  categoriesMock.mockReturnValue(categoriesResult());
});

describe('PosSearch', () => {
  it('muestra la tarjeta del producto con precio y stock', () => {
    renderSearch();

    expect(screen.getByText(PRODUCT.name)).toBeInTheDocument();
    expect(screen.getByText(PRODUCT.sku)).toBeInTheDocument();
    expect(
      screen.getByText(normalizeText(formatCurrency(PRODUCT.salePrice))),
    ).toBeInTheDocument();
    expect(screen.getByText(`Stock ${PRODUCT.stock}`)).toBeInTheDocument();
  });

  it('aplica la búsqueda con retardo', async () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText('Buscar producto'), {
      target: { value: 'agua' },
    });

    await waitFor(
      () => {
        expect(productsMock).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: 'agua', page: 1 }),
        );
      },
      { timeout: 2000 },
    );
  });

  it('filtra por categoría con los chips', () => {
    renderSearch();

    fireEvent.click(screen.getByRole('button', { name: 'Bebidas' }));

    expect(productsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ categoryId: CATEGORY.id, page: 1 }),
    );
  });

  it('agrega el producto al pulsar "Agregar"', () => {
    const onAdd = vi.fn();
    renderSearch(onAdd);

    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(onAdd).toHaveBeenCalledWith(PRODUCT);
  });

  it('deshabilita "Agregar" cuando el producto no tiene stock', () => {
    productsMock.mockReturnValue(
      productsResult({ data: paginated([OUT_OF_STOCK]) }),
    );

    renderSearch();

    expect(screen.getByRole('button', { name: 'Agregar' })).toBeDisabled();
  });

  it('muestra los esqueletos mientras cargan los productos', () => {
    productsMock.mockReturnValue(productsResult({ isLoading: true }));

    renderSearch();

    expect(
      screen.getByRole('status', { name: 'Cargando productos' }),
    ).toBeInTheDocument();
  });

  it('muestra el error y permite reintentar', () => {
    const refetch = vi.fn();
    productsMock.mockReturnValue(
      productsResult({
        isError: true,
        error: new ApiError('Ocurrió un error interno en el servidor.', 500, {
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'No se pudieron cargar los productos',
        }),
        refetch,
      }),
    );

    renderSearch();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudieron cargar los productos',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('muestra el estado vacío cuando no hay resultados', () => {
    productsMock.mockReturnValue(productsResult({ data: paginated([]) }));

    renderSearch();

    expect(
      screen.getByRole('heading', { name: 'No hay productos' }),
    ).toBeInTheDocument();
  });
});
