import type { ReactNode } from 'react';

export interface SkeletonProps {
  readonly className?: string;
}

export function Skeleton({ className }: SkeletonProps): ReactNode {
  return (
    <div
      aria-hidden="true"
      className={[
        'animate-pulse rounded-2xl bg-surface-container-high',
        className ?? '',
      ].join(' ')}
    />
  );
}
