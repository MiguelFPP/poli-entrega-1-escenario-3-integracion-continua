import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { QueryProvider } from '@/components/providers/query-provider';
import { SnackbarProvider } from '@/components/ui';
import type { TopProduct, TopProductSort } from '@/lib/dashboard';
import { formatCurrency } from '@/lib/format';
import { TopProducts } from './top-products';

const ITEMS: TopProduct[] = [
  {
    productId: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
    name: 'Agua Cristal 600 ml',
    sku: 'BEB-001',
    quantity: 5,
    revenue: 48000,
    profit: 7836,
  },
  {
    productId: '8a1b2c3d-4e5f-4a6b-9c7d-1e2f3a4b5c6d',
    name: 'Papas Margarita Pollo 105 g',
    sku: 'SNK-001',
    quantity: 3,
    revenue: 12000,
    profit: 2400,
  },
];

interface RenderOptions {
  readonly data?: TopProduct[];
  readonly sortBy?: TopProductSort;
  readonly isLoading?: boolean;
  readonly isError?: boolean;
  readonly onRetry?: () => void;
}

/** El normalizador de Testing Library colapsa los espacios; el importe usa NBSP. */
function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function renderTopProducts(options: RenderOptions = {}): (
  next: TopProductSort,
) => void {
  const onSortChange = vi.fn();
  render(
    <QueryProvider>
      <SnackbarProvider>
        <TopProducts
          data={options.data ?? ITEMS}
          sortBy={options.sortBy ?? 'quantity'}
          onSortChange={onSortChange}
          isLoading={options.isLoading ?? false}
          isError={options.isError ?? false}
          onRetry={options.onRetry}
        />
      </SnackbarProvider>
    </QueryProvider>,
  );
  return onSortChange;
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

describe('TopProducts', () => {
  it('renderiza las filas con producto, unidades, ingresos y ganancia', () => {
    renderTopProducts();

    expect(screen.getByText('Agua Cristal 600 ml')).toBeInTheDocument();
    expect(screen.getByText('BEB-001')).toBeInTheDocument();
    expect(screen.getByText('Papas Margarita Pollo 105 g')).toBeInTheDocument();
    expect(screen.getByText('SNK-001')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(
      screen.getByText(normalizeText(formatCurrency(ITEMS[0].revenue))),
    ).toBeInTheDocument();
    expect(
      screen.getByText(normalizeText(formatCurrency(ITEMS[0].profit))),
    ).toBeInTheDocument();
  });

  it('emite el nuevo criterio de orden', () => {
    const onSortChange = renderTopProducts();

    fireEvent.click(screen.getByRole('combobox', { name: 'Ordenar por' }));
    fireEvent.click(screen.getByRole('option', { name: 'Ganancia' }));

    expect(onSortChange).toHaveBeenCalledWith('profit');
  });

  it('muestra los esqueletos mientras carga', () => {
    renderTopProducts({ isLoading: true, data: [] });

    expect(
      screen.getByRole('status', { name: 'Cargando productos más vendidos' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('muestra el estado vacío cuando no hay productos', () => {
    renderTopProducts({ data: [] });

    expect(
      screen.getByRole('heading', { name: 'Sin productos vendidos' }),
    ).toBeInTheDocument();
  });

  it('muestra el error y permite reintentar', () => {
    const onRetry = vi.fn();
    renderTopProducts({ data: [], isError: true, onRetry });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudieron cargar los productos más vendidos',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
