'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export interface ErrorPageProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps): ReactNode {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 py-10 text-center">
      <h2 className="text-xl font-semibold text-on-surface">
        Ocurrió un error inesperado
      </h2>
      <p className="max-w-md text-sm text-on-surface-variant">
        No pudimos cargar esta pantalla. Vuelve a intentarlo; si el problema
        persiste, revisa los registros del servidor.
      </p>
      <Button onClick={() => reset()}>Reintentar</Button>
    </main>
  );
}
