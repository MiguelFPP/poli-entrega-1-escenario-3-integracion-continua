import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TextField } from './text-field';

describe('TextField', () => {
  it('asocia la etiqueta al input', () => {
    render(<TextField label="Nombre del producto" />);

    const input = screen.getByLabelText('Nombre del producto');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('id');
  });

  it('muestra el texto de ayuda y lo asocia por aria-describedby', () => {
    render(
      <TextField
        label="Correo"
        helperText="Usaremos este dato para facturar"
      />,
    );

    const input = screen.getByLabelText('Correo');
    const helper = screen.getByText('Usaremos este dato para facturar');
    expect(input).toHaveAttribute(
      'aria-describedby',
      helper.getAttribute('id'),
    );
  });

  it('muestra el error con role="alert" y marca el input como inválido', () => {
    render(<TextField label="Correo" error="El correo no es válido" />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('El correo no es válido');

    const input = screen.getByLabelText('Correo');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', alert.getAttribute('id'));
  });

  it('propaga el valor escrito', () => {
    const onChange = vi.fn();
    render(<TextField label="Cantidad" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Cantidad'), {
      target: { value: '12' },
    });
    expect(onChange).toHaveBeenCalledWith('12');
  });

  it('respeta los estados deshabilitado y requerido', () => {
    render(<TextField label="SKU" required disabled />);

    const input = screen.getByLabelText(/SKU/);
    expect(input).toBeDisabled();
    expect(input).toBeRequired();
  });
});
