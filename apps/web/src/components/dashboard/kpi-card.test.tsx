import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KpiCard, formatDelta } from './kpi-card';

describe('KpiCard', () => {
  it('muestra la etiqueta, el valor y el helper', () => {
    render(
      <KpiCard label="Ventas" value="$120.000" helper="IVA incluido" />,
    );

    expect(screen.getByText('Ventas')).toBeInTheDocument();
    expect(screen.getByText('$120.000')).toBeInTheDocument();
    expect(screen.getByText('IVA incluido')).toBeInTheDocument();
  });

  it('no muestra la variación cuando el delta es nulo', () => {
    render(<KpiCard label="Ventas" value="$120.000" delta={null} />);

    expect(
      screen.queryByText('Variación vs periodo anterior'),
    ).not.toBeInTheDocument();
  });

  it('marca la variación positiva con el color primario', () => {
    render(<KpiCard label="Ventas" value="$120.000" delta={12.5} />);

    expect(screen.getByText(formatDelta(12.5))).toBeInTheDocument();
    expect(
      screen.getByText('Variación vs periodo anterior').closest('p'),
    ).toHaveClass('text-primary');
  });

  it('marca la variación negativa con el color de error', () => {
    render(<KpiCard label="Ventas" value="$120.000" delta={-8} />);

    expect(screen.getByText(formatDelta(-8))).toBeInTheDocument();
    expect(
      screen.getByText('Variación vs periodo anterior').closest('p'),
    ).toHaveClass('text-error');
  });

  it('marca la variación neutra sin color de estado', () => {
    render(<KpiCard label="Ventas" value="$120.000" delta={0} />);

    expect(screen.getByText(formatDelta(0))).toBeInTheDocument();
    expect(
      screen.getByText('Variación vs periodo anterior').closest('p'),
    ).toHaveClass('text-on-surface-variant');
  });
});
