import type { ReactNode, SVGProps } from 'react';

/** Catálogo cerrado de iconos disponibles. */
export type IconName =
  | 'dashboard'
  | 'inventory'
  | 'point-of-sale'
  | 'sales'
  | 'products'
  | 'categories'
  | 'logout'
  | 'menu'
  | 'close'
  | 'add'
  | 'search'
  | 'check'
  | 'warning'
  | 'sun'
  | 'moon'
  | 'settings'
  | 'chevron-down'
  | 'chevron-right'
  | 'user';

const ICON_PATHS: Record<IconName, string> = {
  dashboard: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  inventory: 'M3 7l9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4M12 3v18',
  'point-of-sale':
    'M3 4h2l2.5 11h11L21 8H6M9 20a1 1 0 100-2 1 1 0 000 2m9 0a1 1 0 100-2 1 1 0 000 2',
  sales: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h4',
  products: 'M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10',
  categories: 'M3 12l9-9h8v8l-9 9-8-8zM16 7h.01',
  logout: 'M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 00-2-2h-5',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
  add: 'M12 5v14M5 12h14',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4.2-4.2',
  check: 'M5 13l4 4 10-10',
  warning: 'M12 3l9 16H3zM12 10v4M12 17h.01',
  sun: 'M12 7a5 5 0 100 10 5 5 0 000-10zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20.5 14.3A8.5 8.5 0 019.7 3.5a8.5 8.5 0 1010.8 10.8z',
  settings:
    'M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2 2 2 0 11-4 0 1.7 1.7 0 00-2.9-1.2l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 004.6 15a2 2 0 110-4 1.7 1.7 0 001.2-2.9l-.1-.1a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 0015 4.6a2 2 0 114 0 1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1A1.7 1.7 0 0020.4 11a2 2 0 110 4z',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-right': 'M9 6l6 6-6 6',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20a7.5 7.5 0 0115 0',
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  readonly name: IconName;
  /** Clase de Tailwind con el tamaño; por defecto `size-5`. */
  readonly size?: string;
}

export function Icon({
  name,
  size = 'size-5',
  className,
  ...rest
}: IconProps): ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className ? `${size} ${className}` : size}
      {...rest}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
