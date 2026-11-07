import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Chip } from './chip';

describe('Chip', () => {
  it('muestra la etiqueta', () => {
    render(<Chip label="Bebidas" />);

    expect(screen.getByText('Bebidas')).toBeInTheDocument();
  });

  it('permite borrar el chip con un botón etiquetado', () => {
    const onDelete = vi.fn();
    render(<Chip label="Café" onDelete={onDelete} />);

    const button = screen.getByRole('button', { name: 'Quitar Café' });
    fireEvent.click(button);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('acepta una etiqueta personalizada para el botón de borrado', () => {
    render(
      <Chip
        label="Café"
        onDelete={vi.fn()}
        deleteLabel="Descartar filtro Café"
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Descartar filtro Café' }),
    ).toBeInTheDocument();
  });

  it('no renderiza botón de borrado cuando no se pide', () => {
    render(<Chip label="Bebidas" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('permite interactuar con el chip completo', () => {
    const onClick = vi.fn();
    render(<Chip label="Bebidas" variant="filter" onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Bebidas' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
