'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/theme';
import { Icon } from '@/components/ui/icons';
import type { IconName } from '@/components/ui/icons';
import { useLogout, useSession } from '@/lib/session';

interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: IconName;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
  { label: 'Productos', href: '/productos', icon: 'products' },
  { label: 'Categorías', href: '/categorias', icon: 'categories' },
  { label: 'Inventario', href: '/inventario', icon: 'inventory' },
  { label: 'POS', href: '/pos', icon: 'point-of-sale' },
  { label: 'Ventas', href: '/ventas', icon: 'sales' },
];

const ACTIVE_CLASSES = 'bg-secondary-container text-on-secondary-container';
const INACTIVE_CLASSES =
  'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface';

export interface AppShellProps {
  readonly children?: ReactNode;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: AppShellProps): ReactNode {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: user } = useSession();
  const logout = useLogout();

  const handleLogout = async (): Promise<void> => {
    try {
      await logout.mutateAsync();
    } catch {
      return;
    }
    router.push('/login');
    router.refresh();
  };

  const navClasses = [
    'rounded-3xl bg-surface-container-low p-3 lg:w-64 lg:shrink-0 lg:p-2',
    menuOpen
      ? 'fixed inset-x-0 top-16 z-30 block max-h-[70dvh] overflow-y-auto shadow-lg lg:static lg:z-auto lg:max-h-none lg:overflow-visible lg:shadow-none'
      : 'hidden lg:block',
  ].join(' ');

  return (
    <div className="flex min-h-dvh flex-col bg-background text-on-background">
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 bg-surface-container px-4 shadow-sm">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="nav-principal"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          className="grid size-10 shrink-0 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:hidden"
        >
          <Icon name={menuOpen ? 'close' : 'menu'} />
        </button>

        <div className="flex flex-col">
          <span className="text-lg leading-tight font-semibold text-on-surface">
            POS
          </span>
          <p className="text-xs leading-tight text-on-surface-variant">
            Sistema de punto de venta
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />

          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label="Abrir menú de usuario"
                className="flex items-center gap-2 rounded-full px-2 py-1.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Icon name="user" />
                <span className="hidden max-w-40 truncate sm:inline">
                  {user?.name ?? 'Sesión'}
                </span>
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="z-50 min-w-56 rounded-2xl border border-outline-variant bg-surface-container-high p-1 text-sm text-on-surface shadow-lg focus:outline-none"
              >
                <div className="px-3 py-2">
                  <p className="text-sm font-medium">
                    {user?.name ?? 'Sesión activa'}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {user?.email ?? ''}
                  </p>
                </div>
                <DropdownMenu.Separator className="my-1 h-px bg-outline-variant" />
                <DropdownMenu.Item
                  onSelect={() => {
                    void handleLogout();
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 outline-none data-[highlighted]:bg-surface-container-highest"
                >
                  <Icon name="logout" size="size-4" />
                  Cerrar sesión
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 lg:flex-row">
        <nav
          id="nav-principal"
          aria-label="Navegación principal"
          className={navClasses}
        >
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={[
                      'flex items-center gap-3 rounded-full px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors',
                      active ? ACTIVE_CLASSES : INACTIVE_CLASSES,
                    ].join(' ')}
                  >
                    <Icon name={item.icon} className="shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="flex-1">
          {children ?? (
            <section className="rounded-3xl bg-surface-container p-6">
              <h2 className="text-xl font-semibold text-on-surface">
                Contenido en construcción
              </h2>
              <p className="mt-2 text-sm text-on-surface-variant">
                Este módulo todavía no tiene pantallas: las llega su fase.
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
