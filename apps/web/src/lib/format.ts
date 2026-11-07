const COP_FORMATTER = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
});

/** Importe en pesos colombianos, sin decimales. */
export function formatCurrency(value: number): string {
  return COP_FORMATTER.format(value);
}

/** Fecha y hora en formato colombiano (zona `America/Bogota`). */
export function formatDateTime(value: string): string {
  return DATE_TIME_FORMATTER.format(new Date(value));
}
