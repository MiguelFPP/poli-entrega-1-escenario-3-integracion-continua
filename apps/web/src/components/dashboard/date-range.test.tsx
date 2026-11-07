import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePreset } from '@/lib/dashboard';
import type { DateRange, RangePreset } from '@/lib/dashboard';
import { DateRangePicker } from './date-range';

const FIXED_NOW = new Date('2026-02-15T15:00:00.000Z');

beforeEach(() => {
  // Solo se congela `Date`: los temporizadores reales de React siguen vivos.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function renderPicker(
  preset: RangePreset = '30d',
  value: DateRange = resolvePreset('30d'),
): (next: {
  readonly preset: RangePreset;
  readonly range: DateRange;
}) => void {
  const onChange = vi.fn();
  render(<DateRangePicker value={value} preset={preset} onChange={onChange} />);
  return onChange;
}

describe('DateRangePicker', () => {
  it('renderiza los presets y los campos de fecha', () => {
    renderPicker();

    expect(screen.getByRole('button', { name: 'Hoy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7 días' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 días' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Este mes' })).toBeInTheDocument();
    expect(screen.getByLabelText('Desde')).toBeInTheDocument();
    expect(screen.getByLabelText('Hasta')).toBeInTheDocument();
  });

  it('marca el preset activo y desmarca los demás', () => {
    renderPicker('30d');

    expect(screen.getByRole('button', { name: '30 días' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Hoy' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('emite el rango de Bogotá al elegir un preset', () => {
    const onChange = renderPicker();

    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(onChange).toHaveBeenLastCalledWith({
      preset: 'today',
      range: {
        from: '2026-02-15T05:00:00.000Z',
        to: '2026-02-15T15:00:00.000Z',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: '7 días' }));
    expect(onChange).toHaveBeenLastCalledWith({
      preset: '7d',
      range: {
        from: '2026-02-09T05:00:00.000Z',
        to: '2026-02-15T15:00:00.000Z',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: '30 días' }));
    expect(onChange).toHaveBeenLastCalledWith({
      preset: '30d',
      range: {
        from: '2026-01-17T05:00:00.000Z',
        to: '2026-02-15T15:00:00.000Z',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Este mes' }));
    expect(onChange).toHaveBeenLastCalledWith({
      preset: 'month',
      range: {
        from: '2026-02-01T05:00:00.000Z',
        to: '2026-02-15T15:00:00.000Z',
      },
    });
  });

  it('emite un rango personalizado al cambiar las fechas', () => {
    const value = resolvePreset('30d');
    const onChange = renderPicker('30d', value);

    fireEvent.change(screen.getByLabelText('Desde'), {
      target: { value: '2026-02-03' },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      preset: 'custom',
      range: { from: '2026-02-03T00:00:00.000Z', to: value.to },
    });

    fireEvent.change(screen.getByLabelText('Hasta'), {
      target: { value: '2026-02-10' },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      preset: 'custom',
      range: { from: value.from, to: '2026-02-10T23:59:59.999Z' },
    });
  });
});
