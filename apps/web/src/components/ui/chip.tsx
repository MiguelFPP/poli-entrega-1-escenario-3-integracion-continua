'use client';

import type { ReactNode } from 'react';
import { Icon } from './icons';

export type ChipVariant = 'assist' | 'filter' | 'input';

const VARIANT_CLASSES: Record<ChipVariant, string> = {
  assist: 'bg-secondary-container text-on-secondary-container',
  filter: 'border border-outline bg-surface text-on-surface-variant',
  input: 'border border-outline bg-surface-container text-on-surface',
};

export interface ChipProps {
  readonly label: string;
  readonly variant?: ChipVariant;
  readonly icon?: ReactNode;
  readonly selected?: boolean;
  readonly onClick?: () => void;
  readonly onDelete?: () => void;
  readonly deleteLabel?: string;
  readonly className?: string;
}

export function Chip({
  label,
  variant = 'assist',
  icon,
  selected = false,
  onClick,
  onDelete,
  deleteLabel,
  className,
}: ChipProps): ReactNode {
  const classes = [
    'inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium',
    VARIANT_CLASSES[variant],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {selected ? <Icon name="check" size="size-3.5" /> : null}
      {icon ? <span className="flex items-center">{icon}</span> : null}
      <span className="truncate">{label}</span>
    </>
  );

  return (
    <span
      className={['inline-flex max-w-full items-center gap-1', classes].join(
        ' ',
      )}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex items-center gap-1.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {content}
        </button>
      ) : (
        content
      )}
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={deleteLabel ?? `Quitar ${label}`}
          className="grid size-5 shrink-0 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Icon name="close" size="size-3.5" />
        </button>
      ) : null}
    </span>
  );
}
