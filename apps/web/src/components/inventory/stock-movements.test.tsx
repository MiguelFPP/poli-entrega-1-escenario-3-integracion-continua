import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryProvider } from '@/components/providers/query-provider';
import { ApiError } from '@/lib/api-client';
import type { Paginated } from '@/lib/catalog';
import { formatCurrency, formatDateTime } from '@/lib/format';
import type { StockMovement } from '@/lib/inventory';
import { StockMovements } from './stock-movements';

vi.mock('@/lib/inventory', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/inventory')>();
  return { ...actual, useMovements: vi.fn() };
});

vi.mock('@/lib/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog')>();
  return { ...actual, useProducts: vi.fn() };
});

const { useMovements } = await import('@/lib/inventory');
const { useProducts } = await import('@/lib/catalog');

const movementsMock = vi.mocked(useMovements);
const productsMock = vi.mocked(useProducts);

const ENTRY: StockMovement = {
  id: '3d4e5f6a-7b8c-4d9e-8f0a-1b2c3d4e5f6a',
  productId: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
  product: {
    id: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
    sku: 'BEB-001',
    name: 'Agua Cristal 600 ml',
  },
  type: 'ENTRY',
  quantity: 10,
  previousStock: 96,
  newStock: 106,
  unitCost: 1200,
  reason: 'Compra al proveedor',
  saleId: null,
  user: {
    id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    name: 'Ana Gómez',
    email: 'ana@pos.local',
  },
  createdAt: '2026-02-12T09:15:00.000Z',
};

const SALE: StockMovement = {
  ...ENTRY,
  id: '4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b',
  product: {
    id: '5f6a7b8c-9d0e-4f1a-8b2c-3d4e5f6a7b8c',
    sku: 'SNK-001',
    name: 'Papas Margarita Pollo 105 g',
  },
  type: 'SALE',
  quantity: -2,
  previousStock: 106,
  newStock: 104,
  reason: null,
  saleId: '5f6a7b8c-9d0e-4f1a-8b2c-3d4e5f6a7b8c',
  user: null,
  createdAt: '2026-02-12T10:45:00.000Z',
};

function paginated(
  movements: StockMovement[],
  meta: Partial<Paginated<StockMovement>['meta']> = {},
): Paginated<StockMovement> {
  return {
    data: movements,
    meta: {
      page: 1,
      pageSize: 20,
      total: movements.length,
      totalPages: movements.length > 0 ? 1 : 0,
      hasNextPage: false,
      hasPreviousPage: false,
      ...meta,
    },
  };
}

type MovementsResult = ReturnType<typeof useMovements>;
type ProductsResult = ReturnType<typeof useProducts>;

function movementsResult(
  overrides: Partial<MovementsResult> = {},
): MovementsResult {
  const base: Partial<MovementsResult> = {
    data: undefined,
    error: null,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
  return { ...base, ...overrides } as MovementsResult;
}

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

/** El normalizador de Testing Library colapsa los espacios; el importe usa NBSP. */
function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function renderMovements() {
  return render(
    <QueryProvider>
      <StockMovements />
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
  movementsMock.mockReset();
  productsMock.mockReset();

  productsMock.mockReturnValue(productsResult());
  movementsMock.mockReturnValue(
    movementsResult({ data: paginated([ENTRY, SALE]) }),
  );
});

describe('StockMovements', () => {
  it('renderiza las filas con producto, tipo, cantidad y stock', () => {
    renderMovements();

    expect(
      screen.getByText(normalizeText(formatDateTime(ENTRY.createdAt))),
    ).toBeInTheDocument();
    expect(screen.getByText('Agua Cristal 600 ml')).toBeInTheDocument();
    expect(screen.getByText('BEB-001')).toBeInTheDocument();
    expect(screen.getByText('Papas Margarita Pollo 105 g')).toBeInTheDocument();
    expect(screen.getByText('SNK-001')).toBeInTheDocument();
    expect(screen.getByText('Entrada')).toBeInTheDocument();
    expect(screen.getByText('Venta')).toBeInTheDocument();
    expect(screen.getByText('+10')).toBeInTheDocument();
    expect(screen.getByText('-2')).toBeInTheDocument();
    expect(screen.getByText('96 → 106')).toBeInTheDocument();
    expect(screen.getByText('106 → 104')).toBeInTheDocument();
    expect(
      screen.getAllByText(normalizeText(formatCurrency(ENTRY.unitCost))),
    ).toHaveLength(2);
    expect(screen.getByText('Compra al proveedor')).toBeInTheDocument();
    expect(screen.getByText('Ana Gómez')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('filtra por tipo y reinicia la página', () => {
    renderMovements();

    fireEvent.click(screen.getByRole('combobox', { name: 'Tipo' }));
    fireEvent.click(screen.getByRole('option', { name: 'Venta' }));

    expect(movementsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'SALE', page: 1 }),
    );
  });

  it('convierte las fechas a ISO en la consulta', () => {
    renderMovements();

    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: '2026-02-01' },
    });
    fireEvent.change(screen.getByLabelText('Hasta'), {
      target: { value: '2026-02-28' },
    });

    expect(movementsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        from: '2026-02-01T00:00:00.000Z',
        to: '2026-02-28T23:59:59.999Z',
        page: 1,
      }),
    );
  });

  it('limpia los filtros y conserva el tamaño de página', () => {
    renderMovements();

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(movementsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
    expect(screen.getByLabelText('Desde')).toHaveValue('');
  });

  it('muestra los esqueletos mientras cargan los movimientos', () => {
    movementsMock.mockReturnValue(movementsResult({ isLoading: true }));

    renderMovements();

    expect(
      screen.getByRole('status', { name: 'Cargando movimientos' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('muestra el error y permite reintentar', () => {
    const refetch = vi.fn();
    movementsMock.mockReturnValue(
      movementsResult({
        isError: true,
        error: new ApiError('Ocurrió un error interno en el servidor.', 500, {
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'No se pudieron cargar los movimientos',
        }),
        refetch,
      }),
    );

    renderMovements();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudieron cargar los movimientos',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('muestra el estado vacío cuando no hay movimientos', () => {
    movementsMock.mockReturnValue(movementsResult({ data: paginated([]) }));

    renderMovements();

    expect(
      screen.getByRole('heading', { name: 'No hay movimientos registrados' }),
    ).toBeInTheDocument();
  });

  it('pagina con los metadatos recibidos', () => {
    movementsMock.mockReturnValue(
      movementsResult({
        data: paginated([ENTRY], {
          page: 1,
          total: 45,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: false,
        }),
      }),
    );

    renderMovements();

    expect(
      screen.getByText('Página 1 de 3 · 45 movimientos'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(movementsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });
});
