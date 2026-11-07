import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Select } from './select';

const OPTIONS = [
  { value: 'cafe', label: 'Café' },
  { value: 'leche', label: 'Leche' },
  { value: 'agua', label: 'Agua', disabled: true },
];

beforeAll(() => {
  // jsdom no implementa las APIs que Radix usa para posicionar el desplegable.
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;

  Element.prototype.scrollIntoView ??= vi.fn();
});

describe('Select', () => {
  it('muestra la etiqueta y el placeholder', () => {
    render(<Select label="Producto" options={OPTIONS} />);

    const trigger = screen.getByRole('combobox', { name: 'Producto' });
    expect(trigger).toHaveTextContent('Selecciona una opción');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('abre el desplegable y permite elegir una opción', () => {
    const onValueChange = vi.fn();
    render(
      <Select
        label="Producto"
        options={OPTIONS}
        onValueChange={onValueChange}
      />,
    );

    const trigger = screen.getByRole('combobox', { name: 'Producto' });
    fireEvent.click(trigger);

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    const option = screen.getByRole('option', { name: 'Café' });
    expect(option).toBeInTheDocument();

    fireEvent.click(option);

    expect(onValueChange).toHaveBeenCalledWith('cafe');
    expect(trigger).toHaveTextContent('Café');
  });

  it('respeta el valor controlado', () => {
    render(<Select label="Producto" options={OPTIONS} value="leche" />);

    const trigger = screen.getByRole('combobox', { name: 'Producto' });
    expect(trigger).toHaveTextContent('Leche');
  });

  it('muestra el error con role="alert"', () => {
    render(
      <Select
        label="Producto"
        options={OPTIONS}
        error="Selecciona un producto"
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Selecciona un producto');
    expect(screen.getByRole('combobox', { name: 'Producto' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('no abre el desplegable cuando está deshabilitado', () => {
    render(<Select label="Producto" options={OPTIONS} disabled />);

    const trigger = screen.getByRole('combobox', { name: 'Producto' });
    expect(trigger).toBeDisabled();
  });
});
