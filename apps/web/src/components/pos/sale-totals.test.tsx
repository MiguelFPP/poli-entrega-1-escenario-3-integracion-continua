import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatCurrency } from '@/lib/format';
import { SaleTotals } from './sale-totals';

/** El normalizador de Testing Library colapsa los espacios; el importe usa NBSP. */
function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

describe('SaleTotals', () => {
  it('muestra subtotal, IVA y total formateados en COP', () => {
    render(
      <SaleTotals
        subtotal={35700}
        discountAmount={0}
        taxAmount={5130}
        total={32130}
        itemCount={3}
      />,
    );

    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    expect(
      screen.getByText(normalizeText(formatCurrency(35700))),
    ).toBeInTheDocument();
    expect(screen.getByText('IVA 19% incluido')).toBeInTheDocument();
    expect(
      screen.getByText(normalizeText(formatCurrency(5130))),
    ).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(
      screen.getByText(normalizeText(formatCurrency(32130))),
    ).toBeInTheDocument();
    expect(screen.getByText('3 productos')).toBeInTheDocument();
  });

  it('no muestra la fila de descuento cuando es 0', () => {
    render(
      <SaleTotals
        subtotal={2000}
        discountAmount={0}
        taxAmount={319}
        total={2000}
      />,
    );

    expect(screen.queryByText('Descuento')).not.toBeInTheDocument();
    expect(screen.queryByText(/productos?$/)).not.toBeInTheDocument();
  });

  it('muestra el descuento en negativo cuando es mayor que 0', () => {
    render(
      <SaleTotals
        subtotal={4000}
        discountAmount={400}
        taxAmount={574}
        total={3600}
        itemCount={1}
      />,
    );

    expect(screen.getByText('Descuento')).toBeInTheDocument();
    expect(
      screen.getByText(`-${normalizeText(formatCurrency(400))}`),
    ).toBeInTheDocument();
    expect(screen.getByText('1 producto')).toBeInTheDocument();
  });
});
