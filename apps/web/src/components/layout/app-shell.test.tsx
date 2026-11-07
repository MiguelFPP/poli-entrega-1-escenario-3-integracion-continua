import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell, NAV_ITEMS } from './app-shell';

const push = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push, refresh }),
}));

vi.mock('@/lib/session', () => ({
  useSession: () => ({
    data: {
      id: 'u-1',
      name: 'Administrador POS',
      email: 'admin@pos.local',
      role: 'ADMIN',
      active: true,
      createdAt: '2026-01-15T12:00:00.000Z',
    },
  }),
  useLogout: () => ({ mutateAsync: vi.fn().mockResolvedValue(undefined) }),
}));

describe('AppShell', () => {
  it('muestra la barra superior con la marca del sistema', () => {
    render(<AppShell />);

    const banner = within(screen.getByRole('banner'));
    expect(banner.getByText('POS')).toBeInTheDocument();
    expect(banner.getByText('Sistema de punto de venta')).toBeInTheDocument();
  });

  it('renderiza la navegación principal con sus etiquetas', () => {
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

  it('marca la ruta activa con aria-current', () => {
    render(<AppShell />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Ventas' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('muestra el botón de cambio de tema', () => {
    render(<AppShell />);

    expect(
      screen.getByRole('button', { name: /modo oscuro/i }),
    ).toBeInTheDocument();
  });

  it('ofrece la acción de cerrar sesión en el menú de usuario', () => {
    render(<AppShell />);

    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Abrir menú de usuario' }),
      { button: 0, ctrlKey: false },
    );

    expect(screen.getByText('Cerrar sesión')).toBeInTheDocument();
    expect(screen.getByText('admin@pos.local')).toBeInTheDocument();
  });

  it('renderiza el contenido recibido', () => {
    render(
      <AppShell>
        <p>Contenido de prueba</p>
      </AppShell>,
    );

    expect(screen.getByText('Contenido de prueba')).toBeInTheDocument();
  });

  it('muestra un placeholder cuando no hay contenido', () => {
    render(<AppShell />);

    expect(
      screen.getByRole('heading', { name: 'Contenido en construcción' }),
    ).toBeInTheDocument();
  });
});
