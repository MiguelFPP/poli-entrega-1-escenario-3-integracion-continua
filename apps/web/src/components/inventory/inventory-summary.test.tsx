import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { formatCurrency, formatDateTime } from '@/lib/format';
import type { InventorySummary as InventorySummaryData } from '@/lib/inventory';
import { InventorySummary } from './inventory-summary';

vi.mock('@/lib/inventory', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/inventory')>();
  return { ...actual, useInventorySummary: vi.fn() };
});

const { useInventorySummary } = await import('@/lib/inventory');

const summaryMock = vi.mocked(useInventorySummary);

const SUMMARY: InventorySummaryData = {
  totalProducts: 42,
  totalUnits: 1240,
  inventoryValue: 3180000,
  lowStockCount: 3,
  outOfStockCount: 1,
  generatedAt: '2026-02-12T09:15:00.000Z',
};

type SummaryResult = ReturnType<typeof useInventorySummary>;

function summaryResult(
  overrides: Partial<SummaryResult> = {},
): SummaryResult {
  const base: Partial<SummaryResult> = {
    data: undefined,
    error: null,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
  return { ...base, ...overrides } as SummaryResult;
}

/** El normalizador de Testing Library colapsa los espacios; el importe usa NBSP. */
function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

beforeEach(() => {
  summaryMock.mockReset();
});

describe('InventorySummary', () => {
  it('muestra las métricas del resumen', () => {
    summaryMock.mockReturnValue(summaryResult({ data: SUMMARY }));

    render(<InventorySummary />);

    expect(screen.getByText('Unidades en stock')).toBeInTheDocument();
    expect(screen.getByText(String(SUMMARY.totalUnits))).toBeInTheDocument();
    expect(
      screen.getByText(normalizeText(formatCurrency(SUMMARY.inventoryValue))),
    ).toBeInTheDocument();
    expect(screen.getByText('Stock bajo')).toBeInTheDocument();
    expect(
      screen.getByText(String(SUMMARY.lowStockCount)),
    ).toBeInTheDocument();
    expect(screen.getByText('Agotados')).toBeInTheDocument();
    expect(
      screen.getByText(String(SUMMARY.outOfStockCount)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${SUMMARY.totalProducts} productos`, { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(normalizeText(formatDateTime(SUMMARY.generatedAt)), {
        exact: false,
      }),
    ).toBeInTheDocument();
  });

  it('muestra los esqueletos mientras carga el resumen', () => {
    summaryMock.mockReturnValue(summaryResult({ isLoading: true }));

    render(<InventorySummary />);

    expect(
      screen.getByRole('status', { name: 'Cargando resumen de inventario' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Unidades en stock')).not.toBeInTheDocument();
  });

  it('muestra el error y permite reintentar', () => {
    const refetch = vi.fn();
    summaryMock.mockReturnValue(
      summaryResult({
        isError: true,
        error: new ApiError('Ocurrió un error interno en el servidor.', 500, {
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'No se pudo calcular el inventario',
        }),
        refetch,
      }),
    );

    render(<InventorySummary />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo calcular el inventario',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
