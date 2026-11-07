'use client';

import type { ReactNode } from 'react';
import { Button, TextField } from '@/components/ui';
import { DASHBOARD_PRESETS, resolvePreset } from '@/lib/dashboard';
import type { DateRange, RangePreset } from '@/lib/dashboard';

type PresetOption = Exclude<RangePreset, 'custom'>;

const PRESET_OPTIONS: readonly {
  readonly value: PresetOption;
  readonly label: string;
}[] = DASHBOARD_PRESETS.filter(
  (option): option is { readonly value: PresetOption; readonly label: string } =>
    option.value !== 'custom',
);

function toIsoStart(date: string): string {
  return `${date}T00:00:00.000Z`;
}

function toIsoEnd(date: string): string {
  return `${date}T23:59:59.999Z`;
}

/** Día `YYYY-MM-DD` de un ISO; las presets anclan la medianoche de Bogotá. */
function toDateInput(iso: string): string {
  return Number.isNaN(Date.parse(iso)) ? '' : iso.slice(0, 10);
}

export interface DateRangePickerProps {
  readonly value: DateRange;
  readonly preset: RangePreset;
  readonly onChange: (next: {
    readonly preset: RangePreset;
    readonly range: DateRange;
  }) => void;
}

export function DateRangePicker({
  value,
  preset,
  onChange,
}: DateRangePickerProps): ReactNode {
  const handlePreset = (next: PresetOption): void => {
    onChange({ preset: next, range: resolvePreset(next) });
  };

  const handleFromChange = (next: string): void => {
    const from = next.length > 0 ? toIsoStart(next) : value.from;
    onChange({ preset: 'custom', range: { from, to: value.to } });
  };

  const handleToChange = (next: string): void => {
    const to = next.length > 0 ? toIsoEnd(next) : value.to;
    onChange({ preset: 'custom', range: { from: value.from, to } });
  };

  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-surface-container-low p-4">
      <div
        role="group"
        aria-label="Rango de fechas"
        className="flex flex-wrap items-center gap-2"
      >
        {PRESET_OPTIONS.map((option) => {
          const active = preset === option.value;
          return (
            <Button
              key={option.value}
              variant={active ? 'tonal' : 'outlined'}
              aria-pressed={active}
              onClick={() => {
                handlePreset(option.value);
              }}
            >
              {option.label}
            </Button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Desde"
          type="date"
          value={toDateInput(value.from)}
          onChange={handleFromChange}
        />
        <TextField
          label="Hasta"
          type="date"
          value={toDateInput(value.to)}
          onChange={handleToChange}
        />
      </div>
    </section>
  );
}
