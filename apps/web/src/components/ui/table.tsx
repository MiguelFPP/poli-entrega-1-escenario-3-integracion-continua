import type { ReactNode } from 'react';

export interface TableProps {
  readonly className?: string;
  readonly children?: ReactNode;
}

export function Table({ className, children }: TableProps): ReactNode {
  return (
    <div className="w-full overflow-x-auto rounded-3xl border border-outline-variant bg-surface">
      <table
        className={['w-full border-collapse text-sm', className ?? ''].join(
          ' ',
        )}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className, children }: TableProps): ReactNode {
  return <thead className={className ?? ''}>{children}</thead>;
}

export function TableBody({ className, children }: TableProps): ReactNode {
  return <tbody className={className ?? ''}>{children}</tbody>;
}

export function TableRow({ className, children }: TableProps): ReactNode {
  return (
    <tr
      className={[
        'border-b border-outline-variant last:border-b-0',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </tr>
  );
}

export function TableHead({ className, children }: TableProps): ReactNode {
  return (
    <th
      scope="col"
      className={[
        'px-4 py-3 text-left text-xs font-semibold tracking-wide text-on-surface-variant uppercase',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </th>
  );
}

export function TableCell({ className, children }: TableProps): ReactNode {
  return (
    <td className={['px-4 py-3 text-on-surface', className ?? ''].join(' ')}>
      {children}
    </td>
  );
}

export function TableCaption({ className, children }: TableProps): ReactNode {
  return (
    <caption
      className={[
        'px-4 py-3 text-left text-xs text-on-surface-variant',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </caption>
  );
}
