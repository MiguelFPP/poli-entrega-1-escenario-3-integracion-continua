import type { ReactNode } from 'react';

export type CardVariant = 'outlined' | 'filled';

const VARIANT_CLASSES: Record<CardVariant, string> = {
  outlined: 'border border-outline-variant bg-surface',
  filled: 'border border-transparent bg-surface-container-low',
};

export interface CardProps {
  readonly variant?: CardVariant;
  readonly className?: string;
  readonly children?: ReactNode;
}

export function Card({
  variant = 'outlined',
  className,
  children,
}: CardProps): ReactNode {
  return (
    <section
      className={[
        'rounded-3xl p-6 text-on-surface',
        VARIANT_CLASSES[variant],
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </section>
  );
}

export interface CardSectionProps {
  readonly className?: string;
  readonly children?: ReactNode;
}

export function CardHeader({
  className,
  children,
}: CardSectionProps): ReactNode {
  return (
    <header className={['flex flex-col gap-1', className ?? ''].join(' ')}>
      {children}
    </header>
  );
}

export function CardTitle({
  className,
  children,
}: CardSectionProps): ReactNode {
  return (
    <h2
      className={[
        'text-lg font-semibold text-on-surface',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </h2>
  );
}

export function CardSubtitle({
  className,
  children,
}: CardSectionProps): ReactNode {
  return (
    <p
      className={['text-sm text-on-surface-variant', className ?? ''].join(' ')}
    >
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
}: CardSectionProps): ReactNode {
  return (
    <div
      className={['mt-4 text-sm text-on-surface-variant', className ?? ''].join(
        ' ',
      )}
    >
      {children}
    </div>
  );
}

export function CardActions({
  className,
  children,
}: CardSectionProps): ReactNode {
  return (
    <div
      className={[
        'mt-6 flex flex-wrap items-center justify-end gap-3',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </div>
  );
}
