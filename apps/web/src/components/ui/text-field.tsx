'use client';

import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

export interface TextFieldProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'onChange' | 'value' | 'type' | 'id'
  > {
  readonly label: string;
  readonly id?: string;
  readonly type?: string;
  readonly value?: string;
  readonly onChange?: (value: string) => void;
  readonly error?: string;
  readonly helperText?: string;
  readonly children?: ReactNode;
}

export function TextField({
  label,
  id,
  type = 'text',
  value,
  onChange,
  error,
  helperText,
  required = false,
  disabled = false,
  autoComplete,
  placeholder,
  className,
  ...rest
}: TextFieldProps): ReactNode {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;
  const describedBy = error ? errorId : helperText ? helperId : undefined;

  return (
    <div className={['flex flex-col gap-1.5', className ?? ''].join(' ')}>
      <label htmlFor={inputId} className="text-sm font-medium text-on-surface">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-error">
            {' *'}
          </span>
        ) : null}
      </label>
      <input
        id={inputId}
        type={type}
        value={value}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange?.(event.target.value)}
        className={[
          'h-10 w-full rounded-xl border bg-surface px-3 text-sm text-on-surface',
          'placeholder:text-on-surface-variant',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-error' : 'border-outline',
        ].join(' ')}
        {...rest}
      />
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
