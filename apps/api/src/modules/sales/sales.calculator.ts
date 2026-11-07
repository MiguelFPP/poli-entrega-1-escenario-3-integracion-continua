import { BadRequestException } from '@nestjs/common';

/** Divisor del IVA 19% incluido en el precio de venta. */
export const IVA_DIVISOR = 1.19;

/** Tope de `Decimal(14, 2)` expresado en centavos. */
export const MAX_AMOUNT_CENTS = 99_999_999_999_999;

const DISCOUNT_OVER_SUBTOTAL =
  'El descuento no puede superar el subtotal de la venta';
const INVALID_AMOUNT =
  'El monto debe ser un entero de centavos mayor o igual a 0';
const INVALID_QUANTITY = 'La cantidad debe ser un entero mayor o igual a 1';
const AMOUNT_TOO_LARGE = 'El monto de la venta supera el máximo permitido';

/** Línea de venta con precio y costo unitarios en centavos. */
export type SaleLineCents = {
  readonly unitPriceCents: number;
  readonly unitCostCents: number;
  readonly quantity: number;
};

/** Totales de una línea, en centavos. */
export type SaleLineTotalsCents = {
  readonly lineSubtotal: number;
  readonly lineDiscount: number;
  readonly lineTax: number;
  readonly lineTotal: number;
  readonly lineProfit: number;
};

/** Totales de la venta, en centavos, con el detalle de sus líneas. */
export type SaleTotalsCents = {
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly taxAmount: number;
  readonly total: number;
  readonly costTotal: number;
  readonly profit: number;
  readonly lines: readonly SaleLineTotalsCents[];
};

/** Convierte un importe en pesos a centavos enteros. */
export function toCents(value: number): number {
  if (!Number.isFinite(value)) {
    throw new BadRequestException('El monto debe ser un número válido');
  }

  return Math.round(value * 100);
}

/** Convierte centavos enteros al importe decimal que persiste la base. */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** Reparte el descuento global en proporción al subtotal de cada línea. */
export function distributeDiscountCents(
  lineSubtotalsCents: readonly number[],
  discountCents: number,
): number[] {
  let subtotalCents = 0;

  for (const lineSubtotal of lineSubtotalsCents) {
    if (!Number.isInteger(lineSubtotal) || lineSubtotal < 0) {
      throw new BadRequestException(INVALID_AMOUNT);
    }

    subtotalCents += lineSubtotal;
  }

  if (!Number.isInteger(discountCents) || discountCents < 0) {
    throw new BadRequestException(INVALID_AMOUNT);
  }

  if (discountCents > subtotalCents) {
    throw new BadRequestException(DISCOUNT_OVER_SUBTOTAL);
  }

  if (discountCents === 0 || subtotalCents === 0) {
    return lineSubtotalsCents.map(() => 0);
  }

  const subtotal = BigInt(subtotalCents);
  const discounts = lineSubtotalsCents.map((lineSubtotal) =>
    Number((BigInt(lineSubtotal) * BigInt(discountCents)) / subtotal),
  );
  let residue =
    discountCents - discounts.reduce((acc, value) => acc + value, 0);

  // El residuo del prorrateo se reparte de a un centavo, en orden.
  for (let index = 0; residue > 0 && index < discounts.length; index += 1) {
    discounts[index] += 1;
    residue -= 1;
  }

  return discounts;
}

/** Calcula los totales de la venta en centavos con el IVA 19% incluido. */
export function computeSaleTotals(
  lines: readonly SaleLineCents[],
  discountCents = 0,
): SaleTotalsCents {
  const lineSubtotalsCents = lines.map((line) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new BadRequestException(INVALID_QUANTITY);
    }

    if (!Number.isInteger(line.unitPriceCents) || line.unitPriceCents < 0) {
      throw new BadRequestException(INVALID_AMOUNT);
    }

    if (!Number.isInteger(line.unitCostCents) || line.unitCostCents < 0) {
      throw new BadRequestException(INVALID_AMOUNT);
    }

    const lineSubtotal = line.unitPriceCents * line.quantity;

    if (lineSubtotal > MAX_AMOUNT_CENTS) {
      throw new BadRequestException(AMOUNT_TOO_LARGE);
    }

    return lineSubtotal;
  });

  const discounts = distributeDiscountCents(lineSubtotalsCents, discountCents);
  const lineTotals: SaleLineTotalsCents[] = [];
  let subtotal = 0;
  let discountAmount = 0;
  let taxAmount = 0;
  let total = 0;
  let costTotal = 0;
  let profit = 0;

  lines.forEach((line, index) => {
    const lineSubtotal = lineSubtotalsCents[index];
    const lineDiscount = discounts[index];
    const lineTotal = lineSubtotal - lineDiscount;
    const lineTax = lineTotal - Math.round(lineTotal / IVA_DIVISOR);
    const lineCost = line.unitCostCents * line.quantity;
    const lineProfit = lineTotal - lineTax - lineCost;

    subtotal += lineSubtotal;
    discountAmount += lineDiscount;
    taxAmount += lineTax;
    total += lineTotal;
    costTotal += lineCost;
    profit += lineProfit;

    if (total > MAX_AMOUNT_CENTS) {
      throw new BadRequestException(AMOUNT_TOO_LARGE);
    }

    lineTotals.push({
      lineSubtotal,
      lineDiscount,
      lineTax,
      lineTotal,
      lineProfit,
    });
  });

  return {
    subtotal,
    discountAmount,
    taxAmount,
    total,
    costTotal,
    profit,
    lines: lineTotals,
  };
}
