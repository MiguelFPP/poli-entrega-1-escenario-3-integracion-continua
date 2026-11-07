import type { ReactNode } from 'react';
import { QueryProvider } from '@/components/providers/query-provider';
import { ThemeScript } from '@/components/theme';
import { SnackbarProvider } from '@/components/ui';
import type { Metadata } from 'next';
import '@fontsource-variable/roboto-flex';
import './globals.css';

export const metadata: Metadata = {
  title: 'POS — Sistema de punto de venta',
  description: 'Interfaz web del sistema POS con diseño Material You.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>): ReactNode {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <QueryProvider>
          <SnackbarProvider>{children}</SnackbarProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
