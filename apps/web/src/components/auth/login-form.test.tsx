import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryProvider } from '@/components/providers/query-provider';
import { ApiError } from '@/lib/api-client';
import { LoginForm } from './login-form';

const push = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return { ...actual, apiFetch: vi.fn() };
});

const { apiFetch } = await import('@/lib/api-client');
const apiFetchMock = vi.mocked(apiFetch);

function renderForm() {
  return render(
    <QueryProvider>
      <LoginForm />
    </QueryProvider>,
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
  push.mockReset();
  refresh.mockReset();
});

describe('LoginForm', () => {
  it('muestra los mensajes de validación en español al enviar vacío', async () => {
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(
      await screen.findByText('El correo es obligatorio'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('La contraseña es obligatoria'),
    ).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('envía las credenciales y navega al dashboard', async () => {
    apiFetchMock.mockResolvedValue({
      user: {
        id: 'u-1',
        name: 'Administrador POS',
        email: 'admin@pos.local',
        role: 'ADMIN',
        active: true,
        createdAt: '2026-01-15T12:00:00.000Z',
      },
      accessTokenExpiresIn: 900,
      refreshTokenExpiresIn: 604800,
    });
    renderForm();

    fireEvent.change(screen.getByLabelText(/Correo/), {
      target: { value: 'admin@pos.local' },
    });
    fireEvent.change(screen.getByLabelText(/Contraseña/), {
      target: { value: 'Admin123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/auth/login', {
        method: 'POST',
        json: { email: 'admin@pos.local', password: 'Admin123!' },
      });
    });
    expect(push).toHaveBeenCalledWith('/dashboard');
    expect(refresh).toHaveBeenCalled();
  });

  it('muestra el mensaje de credenciales incorrectas ante un 401', async () => {
    apiFetchMock.mockRejectedValue(
      new ApiError('Tu sesión no es válida o ha expirado.', 401),
    );
    renderForm();

    fireEvent.change(screen.getByLabelText(/Correo/), {
      target: { value: 'admin@pos.local' },
    });
    fireEvent.change(screen.getByLabelText(/Contraseña/), {
      target: { value: 'Admin123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Correo o contraseña incorrectos.');
    expect(push).not.toHaveBeenCalled();
  });

  it('deshabilita el botón mientras la mutación está en curso', async () => {
    apiFetchMock.mockReturnValue(new Promise(() => undefined));
    renderForm();

    fireEvent.change(screen.getByLabelText(/Correo/), {
      target: { value: 'admin@pos.local' },
    });
    fireEvent.change(screen.getByLabelText(/Contraseña/), {
      target: { value: 'Admin123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Iniciar sesión' }),
      ).toBeDisabled();
    });
  });

  it('marca el campo inválido y lo describe con el mensaje de error', async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/Correo/), {
      target: { value: 'no-es-un-correo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    const error = await screen.findByText('El correo no es válido');
    const input = screen.getByLabelText(/Correo/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', error.getAttribute('id'));
  });
});
