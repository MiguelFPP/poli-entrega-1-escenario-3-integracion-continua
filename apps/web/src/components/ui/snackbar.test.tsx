import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SnackbarProvider, useSnackbar } from './snackbar';

function Trigger({
  message,
  action,
}: {
  readonly message: string;
  readonly action?: { readonly label: string; readonly onClick: () => void };
}): ReactNode {
  const { show } = useSnackbar();
  return (
    <button type="button" onClick={() => show(message, { action })}>
      Mostrar
    </button>
  );
}

describe('SnackbarProvider', () => {
  it('muestra el mensaje solicitado en una región viva', () => {
    render(
      <SnackbarProvider>
        <Trigger message="Producto guardado" />
      </SnackbarProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));

    expect(screen.getAllByText('Producto guardado').length).toBeGreaterThan(0);
    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });

  it('ejecuta la acción del aviso y lo cierra', () => {
    const onClick = vi.fn();
    render(
      <SnackbarProvider>
        <Trigger
          message="Producto guardado"
          action={{ label: 'Deshacer', onClick }}
        />
      </SnackbarProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));

    const action = screen.getByRole('button', { name: 'Deshacer' });
    fireEvent.click(action);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Producto guardado')).not.toBeInTheDocument();
  });

  it('falla si se usa el hook sin provider', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    expect(() => render(<Trigger message="Producto guardado" />)).toThrow(
      'useSnackbar debe usarse dentro de un SnackbarProvider',
    );
    consoleError.mockRestore();
  });
});
