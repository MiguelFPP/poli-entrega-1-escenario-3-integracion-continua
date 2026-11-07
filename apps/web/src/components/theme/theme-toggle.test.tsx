import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeToggle } from './theme-toggle';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  window.localStorage.clear();
});

describe('ThemeToggle', () => {
  it('expone el estado del tema oscuro como botón pulsable', () => {
    render(<ThemeToggle />);

    const toggle = screen.getByRole('button', { name: 'Modo oscuro' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('alterna a modo oscuro y persiste la preferencia', () => {
    render(<ThemeToggle />);

    const toggle = screen.getByRole('button', { name: 'Modo oscuro' });
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem('pos-theme')).toBe('dark');
  });

  it('vuelve al modo claro', () => {
    render(<ThemeToggle />);

    const toggle = screen.getByRole('button', { name: 'Modo oscuro' });
    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(window.localStorage.getItem('pos-theme')).toBe('light');
  });

  it('respeta el tema aplicado previamente en el documento', () => {
    window.localStorage.setItem('pos-theme', 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');

    render(<ThemeToggle />);

    expect(screen.getByRole('button', { name: 'Modo oscuro' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
