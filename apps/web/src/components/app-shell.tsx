import type { ReactNode } from 'react';

interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly path: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    path: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  },
  {
    label: 'Productos',
    href: '/productos',
    path: 'M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10',
  },
  {
    label: 'Inventario',
    href: '/inventario',
    path: 'M3 7l9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4',
  },
  {
    label: 'POS',
    href: '/pos',
    path: 'M3 4h2l2.5 11h11L21 8H6M9 20a1 1 0 100-2 1 1 0 000 2m9 0a1 1 0 100-2 1 1 0 000 2',
  },
  {
    label: 'Ventas',
    href: '/ventas',
    path: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h4',
  },
];

interface NavIconProps {
  readonly path: string;
}

function NavIcon({ path }: NavIconProps): ReactNode {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
    >
      <path d={path} />
    </svg>
  );
}

export interface AppShellProps {
  readonly children?: ReactNode;
}

export function AppShell({ children }: AppShellProps): ReactNode {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-on-background">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 bg-surface-container px-4 shadow-sm">
        <span className="grid size-10 place-items-center rounded-full bg-primary text-base font-semibold text-on-primary">
          P
        </span>
        <div className="flex flex-col">
          <h1 className="text-lg leading-tight font-semibold text-on-surface">
            POS
          </h1>
          <p className="text-xs leading-tight text-on-surface-variant">
            Sistema de punto de venta
          </p>
        </div>
        <span className="ml-auto rounded-full bg-secondary-container px-3 py-1 text-xs font-medium text-on-secondary-container">
          Fase 0
        </span>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 lg:flex-row">
        <nav
          aria-label="Navegación principal"
          className="rounded-3xl bg-surface-container-low p-2 lg:w-64 lg:shrink-0"
        >
          <ul className="flex gap-2 overflow-x-auto lg:flex-col">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium whitespace-nowrap text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
                >
                  <NavIcon path={item.path} />
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex-1">
          {children ?? (
            <section className="rounded-3xl bg-surface-container p-6">
              <h2 className="text-xl font-semibold text-on-surface">
                Fase 0 — Bootstrap
              </h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                Sin módulos de negocio todavía: solo infraestructura y endpoint
                de salud.
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
