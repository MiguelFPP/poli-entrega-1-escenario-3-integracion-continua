'use client';

import { useId } from 'react';
import type { ReactNode } from 'react';

export interface CheckboxProps {
  readonly label: string;
  readonly id?: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly error?: string;
  readonly helperText?: string;
  readonly className?: string;
}

export function Checkbox({
  label,
  id,
  checked,
  onChange,
  disabled = false,
  error,
  helperText,
  className,
}: CheckboxProps): ReactNode {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;
  const describedBy = error ? errorId : helperText ? helperId : undefined;

  return (
    <div className={['flex flex-col gap-1.5', className ?? ''].join(' ')}>
      <div className="flex items-center gap-2">
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.checked)}
          className={[
            'size-4 shrink-0 rounded border accent-primary',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error ? 'border-error' : 'border-outline',
          ].join(' ')}
        />
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-on-surface"
        >
          {label}
        </label>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-error">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-xs text-on-surface-variant">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
