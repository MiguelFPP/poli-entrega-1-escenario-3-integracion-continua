import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Paginated, PriceHistoryEntry } from '@/lib/catalog';
import { formatCurrency } from '@/lib/format';
import { PriceHistory } from './price-history';

vi.mock('@/lib/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/catalog')>();
  return { ...actual, usePriceHistory: vi.fn() };
});

const { usePriceHistory } = await import('@/lib/catalog');

const historyMock = vi.mocked(usePriceHistory);

const ENTRIES: PriceHistoryEntry[] = [
  {
    id: '9a8b7c6d-5e4f-4a3b-9c2d-1e0f3a4b5c6d',
    productId: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
    field: 'SALE',
    oldValue: 2000,
    newValue: 2200,
    changedBy: {
      id: '4f1c9f5e-4c0f-4d4a-9e0b-7a9f5b2d3c11',
      name: 'Administrador POS',
      email: 'admin@pos.local',
    },
    createdAt: '2026-02-12T09:15:00.000Z',
  },
  {
    id: '1b2c3d4e-5f60-4718-8293-a4b5c6d7e8f9',
    productId: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
    field: 'COST',
    oldValue: 0,
    newValue: 1200,
    changedBy: null,
    createdAt: '2026-02-10T14:30:00.000Z',
  },
];

function historyResult(
  entries: PriceHistoryEntry[],
  overrides: Record<string, unknown> = {},
) {
  const data: Paginated<PriceHistoryEntry> = {
    data: entries,
    meta: {
      page: 1,
      pageSize: 10,
      total: entries.length,
      totalPages: entries.length > 0 ? 1 : 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };

  return {
    data,
    error: null,
    isLoading: false,
    isError: false,
    ...overrides,
  } as unknown as ReturnType<typeof usePriceHistory>;
}

/** El normalizador de Testing Library colapsa los espacios; el precio usa NBSP. */
function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

beforeEach(() => {
  historyMock.mockReset();
  historyMock.mockReturnValue(historyResult(ENTRIES));
});

describe('PriceHistory', () => {
  it('renderiza una fila por entrada con los valores y el autor', () => {
    render(<PriceHistory productId="producto-1" />);

    const rows = screen.getAllByRole('row');
    // Una fila de encabezado más una por entrada.
    expect(rows).toHaveLength(ENTRIES.length + 1);

    expect(screen.getByText('Precio de venta')).toBeInTheDocument();
    expect(screen.getByText('Costo')).toBeInTheDocument();
    expect(
      screen.getByText(normalizeText(formatCurrency(2000))),
    ).toBeInTheDocument();
    expect(
      screen.getByText(normalizeText(formatCurrency(2200))),
    ).toBeInTheDocument();
    expect(screen.getByText('Administrador POS')).toBeInTheDocument();
  });

  it('muestra "Sistema" cuando el cambio no tiene autor', () => {
    render(<PriceHistory productId="producto-1" />);

    expect(screen.getByText('Sistema')).toBeInTheDocument();
    expect(screen.queryByText('Administrador POS')).not.toBeNull();
  });

  it('muestra el estado vacío cuando no hay cambios registrados', () => {
    historyMock.mockReturnValue(historyResult([]));

    render(<PriceHistory productId="producto-1" />);

    expect(
      screen.getByRole('heading', { name: 'Sin cambios de precio' }),
    ).toBeInTheDocument();
  });

  it('muestra los esqueletos mientras carga el historial', () => {
    historyMock.mockReturnValue(
      historyResult([], { data: undefined, isLoading: true }),
    );

    render(<PriceHistory productId="producto-1" />);

    expect(
      screen.getByRole('status', { name: 'Cargando historial de precios' }),
    ).toBeInTheDocument();
  });

  it('muestra el mensaje de error y permite reintentar', () => {
    historyMock.mockReturnValue(
      historyResult([], {
        data: undefined,
        isError: true,
        error: new Error('fallo de red'),
      }),
    );

    render(<PriceHistory productId="producto-1" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument();
  });
});
