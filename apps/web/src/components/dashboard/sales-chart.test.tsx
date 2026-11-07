import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SalesTrendPoint } from '@/lib/dashboard';
import { formatCurrency } from '@/lib/format';
import { SalesChart, formatTrendPeriod } from './sales-chart';

const DATA: SalesTrendPoint[] = [
  {
    period: '2026-02-13',
    totalSales: 120000,
    netSales: 100840,
    grossProfit: 20000,
    transactions: 2,
  },
  {
    period: '2026-02-14',
    totalSales: 80000,
    netSales: 67227,
    grossProfit: 12000,
    transactions: 1,
  },
  {
    period: '2026-02-15',
    totalSales: 150000,
    netSales: 126050,
    grossProfit: 30000,
    transactions: 3,
  },
];

describe('SalesChart', () => {
  it('dibuja una barra por punto con su etiqueta accesible', () => {
    const { container } = render(<SalesChart data={DATA} granularity="day" />);

    expect(
      screen.getByRole('img', { name: 'Tendencia de ventas' }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('rect')).toHaveLength(DATA.length);
  });

  it('añade un título con el periodo y el total por barra', () => {
    const { container } = render(<SalesChart data={DATA} granularity="day" />);

    const titles = Array.from(container.querySelectorAll('title')).map(
      (node) => node.textContent ?? '',
    );

    expect(titles).toHaveLength(DATA.length);
    expect(titles[0]).toContain(formatTrendPeriod(DATA[0].period, 'day'));
    expect(titles[0]).toContain(formatCurrency(DATA[0].totalSales));
  });

  it('muestra el estado vacío cuando no hay datos', () => {
    render(<SalesChart data={[]} granularity="day" />);

    expect(
      screen.getByRole('heading', { name: 'Sin ventas en el periodo' }),
    ).toBeInTheDocument();
  });

  it('muestra los esqueletos mientras carga', () => {
    render(<SalesChart data={[]} granularity="day" isLoading />);

    expect(
      screen.getByRole('status', { name: 'Cargando tendencia de ventas' }),
    ).toBeInTheDocument();
  });

  it('muestra el error y permite reintentar', () => {
    const onRetry = vi.fn();
    render(<SalesChart data={[]} granularity="day" isError onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo cargar la tendencia de ventas',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
