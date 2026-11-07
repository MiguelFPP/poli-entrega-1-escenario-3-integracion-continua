/** Divisor del IVA 19% incluido en el precio de venta (igual que la API). */
const IVA_DIVISOR = 1.19;

/** Línea del carrito con el precio y la cantidad necesarios para totalizar. */
export interface CartTotalLine {
  readonly unitPrice: number;
  readonly quantity: number;
}

/** Totales del carrito en COP. */
export interface CartTotals {
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly taxAmount: number;
  readonly total: number;
}

/** Convierte un importe en pesos a centavos enteros. */
function toCents(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

/** Convierte centavos enteros al importe decimal en pesos. */
function fromCents(cents: number): number {
  return cents / 100;
}

/** Reparte el descuento global en proporción al subtotal; el residuo va en orden. */
function distributeDiscountCents(
  lineSubtotalsCents: readonly number[],
  discountCents: number,
): number[] {
  const subtotalCents = lineSubtotalsCents.reduce(
    (total, lineSubtotal) => total + lineSubtotal,
    0,
  );

  if (discountCents <= 0 || subtotalCents <= 0) {
    return lineSubtotalsCents.map(() => 0);
  }

  const subtotal = BigInt(subtotalCents);
  const discounts = lineSubtotalsCents.map((lineSubtotal) =>
    Number((BigInt(lineSubtotal) * BigInt(discountCents)) / subtotal),
  );
  let residue =
    discountCents - discounts.reduce((total, value) => total + value, 0);

  for (let index = 0; residue > 0 && index < discounts.length; index += 1) {
    discounts[index] += 1;
    residue -= 1;
  }

  return discounts;
}

/**
 * Totales del carrito en COP con el mismo prorrateo y redondeo que la API:
 * descuento por línea, `lineTax = lineTotal - round(lineTotal / 1.19)` y
 * sumas por línea (IVA 19% incluido).
 */
export function computeCartTotals(
  items: readonly CartTotalLine[],
  discountAmount: number,
): CartTotals {
  const lineSubtotalsCents = items.map((item) => {
    const quantity = Number.isFinite(item.quantity)
      ? Math.max(0, Math.trunc(item.quantity))
      : 0;
    return toCents(item.unitPrice) * quantity;
  });

  const subtotalCents = lineSubtotalsCents.reduce(
    (total, lineSubtotal) => total + lineSubtotal,
    0,
  );
  const discountCents = Math.min(
    Math.max(0, toCents(discountAmount)),
    subtotalCents,
  );
  const discounts = distributeDiscountCents(lineSubtotalsCents, discountCents);

  let taxCents = 0;
  let totalCents = 0;

  lineSubtotalsCents.forEach((lineSubtotal, index) => {
    const lineTotal = lineSubtotal - discounts[index];
    taxCents += lineTotal - Math.round(lineTotal / IVA_DIVISOR);
    totalCents += lineTotal;
  });

  return {
    subtotal: fromCents(subtotalCents),
    discountAmount: fromCents(discountCents),
    taxAmount: fromCents(taxCents),
    total: fromCents(totalCents),
  };
}
