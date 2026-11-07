import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell, NAV_ITEMS } from './app-shell';

describe('AppShell', () => {
  it('muestra el nombre del sistema y el estado de la fase', () => {
    render(<AppShell />);

    expect(screen.getByRole('heading', { name: 'POS' })).toBeInTheDocument();
    expect(screen.getByText('Fase 0')).toBeInTheDocument();
  });

  it('renderiza la navegación principal de la fase 0', () => {
    render(<AppShell />);

    const navigation = screen.getByRole('navigation', {
      name: 'Navegación principal',
    });
    expect(navigation).toBeInTheDocument();

    for (const label of [
      'Dashboard',
      'Productos',
      'Inventario',
      'POS',
      'Ventas',
    ]) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(NAV_ITEMS).toHaveLength(5);
  });

  it('renderiza el contenido recibido', () => {
    render(
      <AppShell>
        <p>Contenido de prueba</p>
      </AppShell>,
    );

    expect(screen.getByText('Contenido de prueba')).toBeInTheDocument();
  });
});
