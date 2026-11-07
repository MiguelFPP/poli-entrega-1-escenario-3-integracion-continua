import type { ReactNode } from 'react';

/** Clave de `localStorage` donde se persiste el tema elegido. */
export const THEME_STORAGE_KEY = 'pos-theme';

/** Tema explícito aplicado al elemento `<html>`. */
export type Theme = 'light' | 'dark';

/**
 * Script estático que aplica el tema persistido antes de la hidratación
 * para evitar el destello con el color equivocado.
 */
const THEME_SCRIPT = [
  '(function(){try{',
  'var t=localStorage.getItem("pos-theme");',
  'if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t);}',
  '}catch(e){}})();',
].join('');

export function ThemeScript(): ReactNode {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
