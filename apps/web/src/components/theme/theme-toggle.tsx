'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/icons';
import { THEME_STORAGE_KEY } from './theme-script';
import type { Theme } from './theme-script';

type Listener = () => void;

const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener('storage', notify);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('storage', notify);
    }
  };
}

function prefersDark(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/** Tema efectivo: el explícito en `<html>` o, si no hay, el del sistema. */
function currentTheme(): Theme {
  if (typeof document === 'undefined') {
    return 'light';
  }
  const attribute = document.documentElement.getAttribute('data-theme');
  if (attribute === 'dark' || attribute === 'light') {
    return attribute;
  }
  return prefersDark() ? 'dark' : 'light';
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Sin persistencia disponible: el tema solo vive en esta pestaña.
  }
  notify();
}

export function ThemeToggle(): ReactNode {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'light');
  const isDark = theme === 'dark';

  const toggle = useCallback(() => {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Modo oscuro"
      aria-pressed={isDark}
      className="grid size-10 shrink-0 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Icon name={isDark ? 'sun' : 'moon'} />
    </button>
  );
}
