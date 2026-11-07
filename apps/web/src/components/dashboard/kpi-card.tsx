'use client';

import type { ReactNode } from 'react';

const DELTA_FORMATTER = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 1,
});

/** Texto de la variación: flecha según el signo y magnitud en porcentaje. */
export function formatDelta(delta: number): string {
  if (delta > 0) {
    return `▲ ${DELTA_FORMATTER.format(delta)}%`;
  }
  if (delta < 0) {
    return `▼ ${DELTA_FORMATTER.format(Math.abs(delta))}%`;
  }
  return `${DELTA_FORMATTER.format(0)}%`;
}

/** Color del indicador: sube en primario, baja en error y neutro en gris. */
function deltaClasses(delta: number): string {
  if (delta > 0) {
    return 'text-primary';
  }
  if (delta < 0) {
    return 'text-error';
  }
  return 'text-on-surface-variant';
}

export interface KpiCardProps {
  readonly label: string;
  readonly value: string;
  readonly helper?: string;
  readonly delta?: number | null;
  readonly icon?: ReactNode;
}

export function KpiCard({
  label,
  value,
  helper,
  delta,
  icon,
}: KpiCardProps): ReactNode {
  return (
    <section className="flex flex-col gap-2 rounded-3xl bg-surface-container-low p-6">
      <header className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-on-surface-variant uppercase">
          {label}
        </p>
        {icon ? (
          <span className="shrink-0 text-on-surface-variant">{icon}</span>
        ) : null}
      </header>

      <p className="text-2xl font-semibold text-on-surface">{value}</p>

      {typeof delta === 'number' ? (
        <p
          className={[
            'flex items-center gap-1 text-xs font-medium',
            deltaClasses(delta),
          ].join(' ')}
        >
          <span aria-hidden="true">{formatDelta(delta)}</span>
          <span className="sr-only">Variación vs periodo anterior</span>
        </p>
      ) : null}

      {helper ? (
        <p className="text-xs text-on-surface-variant">{helper}</p>
      ) : null}
    </section>
  );
}
