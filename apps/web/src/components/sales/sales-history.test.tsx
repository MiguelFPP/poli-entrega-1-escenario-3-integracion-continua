import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryProvider } from '@/components/providers/query-provider';
import { ApiError } from '@/lib/api-client';
import { formatCurrency, formatDateTime } from '@/lib/format';
import type { Paginated, PaginationMeta } from '@/lib/catalog';
import type { SaleSummary } from '@/lib/sales';
import { SalesHistory } from './sales-history';

vi.mock('@/lib/sales', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/sales')>();
  return { ...actual, useSales: vi.fn() };
});

const { useSales } = await import('@/lib/sales');

const salesMock = vi.mocked(useSales);

const SALE: SaleSummary = {
  id: '3c4d5e6f-7a8b-4c9d-9e0f-1a2b3c4d5e6f',
  number: 'V-000001',
  status: 'COMPLETED',
  total: 32130,
  itemCount: 2,
  paymentMethod: 'CASH',
  createdAt: '2026-02-12T09:15:00.000Z',
  voidedAt: null,
  user: {
    id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    name: 'Ana Gómez',
    email: 'ana@pos.local',
  },
};

const VOIDED: SaleSummary = {
  ...SALE,
  id: '4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b',
  number: 'V-000002',
  status: 'VOIDED',
  total: 5000,
  itemCount: 1,
  paymentMethod: 'CARD',
  createdAt: '2026-02-12T10:45:00.000Z',
  voidedAt: '2026-02-12T11:00:00.000Z',
};

function paginated(
  sales: SaleSummary[],
  meta: Partial<PaginationMeta> = {},
): Paginated<SaleSummary> {
  return {
    data: sales,
    meta: {
      page: 1,
      pageSize: 20,
      total: sales.length,
      totalPages: sales.length > 0 ? 1 : 0,
      hasNextPage: false,
      hasPreviousPage: false,
      ...meta,
    },
  };
}

type SalesResult = ReturnType<typeof useSales>;

function salesResult(overrides: Partial<SalesResult> = {}): SalesResult {
  const base: Partial<SalesResult> = {
    data: paginated([SALE, VOIDED]),
    error: null,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
  return { ...base, ...overrides } as SalesResult;
}

/** El normalizador de Testing Library colapsa los espacios; el importe usa NBSP. */
function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function renderHistory() {
  return render(
    <QueryProvider>
      <SalesHistory />
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
  salesMock.mockReset();
  salesMock.mockReturnValue(salesResult());
});

describe('SalesHistory', () => {
  it('renderiza las filas con número, estado, pago y total', () => {
    renderHistory();

    expect(screen.getByRole('link', { name: 'V-000001' })).toHaveAttribute(
      'href',
      `/ventas/${SALE.id}`,
    );
    expect(
      screen.getByText(normalizeText(formatDateTime(SALE.createdAt))),
    ).toBeInTheDocument();
    expect(screen.getByText('Completada')).toBeInTheDocument();
    expect(screen.getByText('Anulada')).toBeInTheDocument();
    expect(screen.getByText('Efectivo')).toBeInTheDocument();
    expect(screen.getByText('Tarjeta')).toBeInTheDocument();
    expect(screen.getByText(String(SALE.itemCount))).toBeInTheDocument();
    expect(
      screen.getByText(normalizeText(formatCurrency(SALE.total))),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Ana Gómez')).toHaveLength(2);
  });

  it('filtra por estado y reinicia la página', () => {
    renderHistory();

    fireEvent.click(screen.getByRole('combobox', { name: 'Estado' }));
    fireEvent.click(screen.getByRole('option', { name: 'Anulada' }));

    expect(salesMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'VOIDED', page: 1 }),
    );
  });

  it('convierte las fechas a ISO en la consulta', () => {
    renderHistory();

    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: '2026-02-01' },
    });
    fireEvent.change(screen.getByLabelText('Hasta'), {
      target: { value: '2026-02-28' },
    });

    expect(salesMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        from: '2026-02-01T00:00:00.000Z',
        to: '2026-02-28T23:59:59.999Z',
        page: 1,
      }),
    );
  });

  it('limpia los filtros y conserva el tamaño de página', () => {
    renderHistory();

    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: '2026-02-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(salesMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
    expect(screen.getByLabelText('Desde')).toHaveValue('');
  });

  it('muestra los esqueletos mientras cargan las ventas', () => {
    salesMock.mockReturnValue(salesResult({ isLoading: true }));

    renderHistory();

    expect(
      screen.getByRole('status', { name: 'Cargando ventas' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('muestra el error y permite reintentar', () => {
    const refetch = vi.fn();
    salesMock.mockReturnValue(
      salesResult({
        isError: true,
        error: new ApiError('Ocurrió un error interno en el servidor.', 500, {
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'No se pudieron cargar las ventas',
        }),
        refetch,
      }),
    );

    renderHistory();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudieron cargar las ventas',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('muestra el estado vacío cuando no hay ventas', () => {
    salesMock.mockReturnValue(salesResult({ data: paginated([]) }));

    renderHistory();

    expect(
      screen.getByRole('heading', { name: 'No hay ventas' }),
    ).toBeInTheDocument();
  });

  it('pagina con los metadatos recibidos', () => {
    salesMock.mockReturnValue(
      salesResult({
        data: paginated([SALE], {
          page: 1,
          total: 45,
          totalPages: 3,
          hasNextPage: true,
          hasPreviousPage: false,
        }),
      }),
    );

    renderHistory();

    expect(screen.getByText('Página 1 de 3 · 45 ventas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(salesMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });
});
