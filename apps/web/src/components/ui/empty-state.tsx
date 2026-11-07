import type { ReactNode } from 'react';

export interface EmptyStateProps {
  readonly icon?: ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps): ReactNode {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-outline-variant bg-surface-container-low px-6 py-12 text-center',
        className ?? '',
      ].join(' ')}
    >
      {icon ? (
        <span className="grid size-12 place-items-center rounded-full bg-surface-container-high text-on-surface-variant">
          {icon}
        </span>
      ) : null}
      <h2 className="text-base font-semibold text-on-surface">{title}</h2>
      {description ? (
        <p className="max-w-md text-sm text-on-surface-variant">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
