'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './icons';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface SelectProps {
  readonly label: string;
  readonly options: readonly SelectOption[];
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  readonly placeholder?: string;
  readonly error?: string;
  readonly helperText?: string;
  readonly disabled?: boolean;
  readonly id?: string;
  readonly className?: string;
}

export function Select({
  label,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = 'Selecciona una opción',
  error,
  helperText,
  disabled = false,
  id,
  className,
}: SelectProps): ReactNode {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const labelId = `${triggerId}-label`;
  const errorId = `${triggerId}-error`;
  const helperId = `${triggerId}-helper`;
  const describedBy = error ? errorId : helperText ? helperId : undefined;

  return (
    <div className={['flex flex-col gap-1.5', className ?? ''].join(' ')}>
      <label
        id={labelId}
        htmlFor={triggerId}
        className="text-sm font-medium text-on-surface"
      >
        {label}
      </label>
      <SelectPrimitive.Root
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger
          id={triggerId}
          aria-labelledby={labelId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={[
            'flex h-10 w-full items-center justify-between gap-2 rounded-xl border bg-surface px-3 text-sm text-on-surface',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error ? 'border-error' : 'border-outline',
          ].join(' ')}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon className="text-on-surface-variant">
            <Icon name="chevron-down" size="size-4" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className="z-50 overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low text-on-surface shadow-lg"
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={[
                    'relative flex cursor-pointer select-none items-center rounded-xl py-2 pr-3 pl-8 text-sm outline-none',
                    'data-[highlighted]:bg-surface-container-highest',
                    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                  ].join(' ')}
                >
                  <SelectPrimitive.ItemIndicator className="absolute left-2 text-primary">
                    <Icon name="check" size="size-4" />
                  </SelectPrimitive.ItemIndicator>
                  <SelectPrimitive.ItemText>
                    {option.label}
                  </SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
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
