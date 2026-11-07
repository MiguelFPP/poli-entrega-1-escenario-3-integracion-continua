import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('renderiza un botón con el texto indicado', () => {
    render(<Button>Guardar</Button>);

    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('type', 'button');
  });

  it('aplica la variante y el tamaño sólidos', () => {
    render(
      <Button variant="filled" size="lg">
        Guardar
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button).toHaveClass('bg-primary');
    expect(button).toHaveClass('text-on-primary');
    expect(button).toHaveClass('h-12');
  });

  it('aplica la variante tonal', () => {
    render(<Button variant="tonal">Cancelar</Button>);

    const button = screen.getByRole('button', { name: 'Cancelar' });
    expect(button).toHaveClass('bg-secondary-container');
    expect(button).toHaveClass('text-on-secondary-container');
  });

  it('aplica la variante de peligro', () => {
    render(<Button variant="danger">Eliminar</Button>);

    const button = screen.getByRole('button', { name: 'Eliminar' });
    expect(button).toHaveClass('bg-error');
    expect(button).toHaveClass('text-on-error');
  });

  it('deshabilita el botón y marca el estado ocupado mientras carga', () => {
    render(<Button loading>Guardar</Button>);

    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('respeta el tipo explícito y el ancho completo', () => {
    render(
      <Button type="submit" fullWidth>
        Enviar
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Enviar' });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveClass('w-full');
  });

  it('propaga el clic al handler', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
