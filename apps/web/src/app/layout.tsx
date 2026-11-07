import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/roboto-flex';
import './globals.css';

export const metadata: Metadata = {
  title: 'POS — Sistema de punto de venta',
  description: 'Interfaz web del sistema POS (fase 0: bootstrap).',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>): ReactNode {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
