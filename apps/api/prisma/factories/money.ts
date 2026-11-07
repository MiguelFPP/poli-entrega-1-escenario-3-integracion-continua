/** Tasa de IVA de Colombia aplicada a los precios de venta (IVA incluido). */
export const IVA_RATE = 0.19;

/** Valor monetario normalizado a dos decimales. */
export type Money = number;

/** Redondea a dos decimales (medio hacia arriba, admite negativos). */
export function round2(value: number): Money {
  if (!Number.isFinite(value)) {
    throw new Error(`[factories] Valor monetario inválido: ${String(value)}`);
  }
  return (
    (Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100)) /
    100
  );
}

/** Acepta un `Decimal` de Prisma, string o number y devuelve un number. */
export function toNumber(
  value: number | string | { toString(): string },
): Money {
  const parsed = typeof value === 'number' ? value : Number(value.toString());
  if (!Number.isFinite(parsed)) {
    throw new Error(
      `[factories] No se pudo convertir a número: ${String(value)}`,
    );
  }
  return parsed;
}

/** Impuesto contenido en un importe con IVA incluido. */
export function taxFromGross(gross: Money): Money {
  return round2(gross - gross / (1 + IVA_RATE));
}

/** Valida que un importe monetario sea finito y no negativo. */
export function assertNonNegative(label: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `[factories] ${label} debe ser un monto >= 0 (recibido: ${value})`,
    );
  }
}

/**
 * Reparte un descuento global sobre varias líneas.
 * El residuo del redondeo se aplica a la última línea para que la suma cuadre.
 */
export function distributeDiscount(
  grossValues: readonly Money[],
  rate: number,
): Money[] {
  if (!Number.isFinite(rate) || rate < 0 || rate >= 1) {
    throw new Error(
      `[factories] discountRate debe estar en [0, 1) (recibido: ${rate})`,
    );
  }
  if (rate === 0) {
    return grossValues.map(() => 0);
  }

  const total = round2(grossValues.reduce((acc, value) => acc + value, 0));
  const target = round2(total * rate);
  const discounts = grossValues.map((value) => round2(value * rate));
  const lastIndex = discounts.length - 1;
  const last = discounts[lastIndex];

  if (lastIndex >= 0 && last !== undefined) {
    discounts[lastIndex] = round2(
      last + round2(target - discounts.reduce((acc, value) => acc + value, 0)),
    );
  }

  return discounts;
}
