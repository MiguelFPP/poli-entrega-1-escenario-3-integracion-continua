'use client';

import { useId } from 'react';
import type { ReactNode, TextareaHTMLAttributes } from 'react';

export interface TextAreaProps
  extends Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    'onChange' | 'value' | 'id'
  > {
  readonly label: string;
  readonly id?: string;
  readonly value?: string;
  readonly onChange?: (value: string) => void;
  readonly error?: string;
  readonly helperText?: string;
  readonly rows?: number;
}

export function TextArea({
  label,
  id,
  value,
  onChange,
  error,
  helperText,
  rows = 3,
  required = false,
  disabled = false,
  placeholder,
  className,
  ...rest
}: TextAreaProps): ReactNode {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const errorId = `${textareaId}-error`;
  const helperId = `${textareaId}-helper`;
  const describedBy = error ? errorId : helperText ? helperId : undefined;

  return (
    <div className={['flex flex-col gap-1.5', className ?? ''].join(' ')}>
      <label
        htmlFor={textareaId}
        className="text-sm font-medium text-on-surface"
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="text-error">
            {' *'}
          </span>
        ) : null}
      </label>
      <textarea
        id={textareaId}
        rows={rows}
        value={value}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange?.(event.target.value)}
        className={[
          'w-full rounded-xl border bg-surface px-3 py-2 text-sm text-on-surface',
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
