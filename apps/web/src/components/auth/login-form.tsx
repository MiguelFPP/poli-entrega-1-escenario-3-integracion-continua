'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api-client';
import { useLogin } from '@/lib/session';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'El correo es obligatorio')
    .pipe(z.email('El correo no es válido')),
  password: z
    .string()
    .min(1, 'La contraseña es obligatoria')
    .pipe(z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')),
});

type LoginValues = z.infer<typeof loginSchema>;

const DEMO_EMAIL = 'admin@pos.local';
const DEMO_PASSWORD = 'Admin123!';

/** Traduce el error de la API a un mensaje comprensible para el usuario. */
function messageForError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Correo o contraseña incorrectos.';
    }
    if (error.status === 429) {
      return 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.';
    }
    if (error.status === 403) {
      return 'Origen de la solicitud no permitido.';
    }
  }
  return 'No se pudo iniciar sesión. Inténtalo de nuevo.';
}

export function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await login.mutateAsync({
        email: values.email,
        password: values.password,
      });
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      setServerError(messageForError(error));
    }
  });

  const pending = login.isPending;

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-3xl bg-surface-container-low p-6"
    >
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextField
            label="Correo"
            type="email"
            autoComplete="username"
            placeholder="nombre@pos.local"
            required
            disabled={pending}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.email?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            disabled={pending}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.password?.message}
          />
        )}
      />

      {serverError ? (
        <p role="alert" className="text-sm text-error">
          {serverError}
        </p>
      ) : null}

      <Button type="submit" loading={pending} disabled={pending} fullWidth>
        Iniciar sesión
      </Button>

      <p className="text-xs text-on-surface-variant">
        Credenciales de demostración: {DEMO_EMAIL} / {DEMO_PASSWORD}
      </p>
    </form>
  );
}
