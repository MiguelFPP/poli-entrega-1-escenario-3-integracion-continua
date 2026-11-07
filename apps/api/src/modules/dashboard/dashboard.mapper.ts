import { PaymentMethod } from '../../generated/prisma/client.js';
import type { DashboardLowStockItemDto } from './dto/dashboard-low-stock.dto.js';
import type { DashboardRangeResponseDto } from './dto/dashboard-summary.dto.js';
import type { PaymentMethodBreakdownDto } from './dto/payment-methods.dto.js';
import type { TrendGranularity } from './dto/query-trend.dto.js';
import type { SalesTrendPointDto } from './dto/sales-trend.dto.js';
import type { TopProductItemDto } from './dto/top-products.dto.js';

/** Zona horaria del negocio: los `createdAt` se persisten en UTC. */
export const BOGOTA_TIME_ZONE = 'America/Bogota';

const MS_PER_DAY = 86_400_000;

/** Orden fijo de los métodos de pago en la respuesta. */
export const PAYMENT_METHOD_ORDER: readonly PaymentMethod[] = [
  PaymentMethod.CASH,
  PaymentMethod.CARD,
];

/** Valor monetario: solo necesita exponer su importe en pesos. */
export type DecimalValue = { toNumber(): number };

/** Totales de ventas agregados en centavos. */
export type SalesTotalsCents = {
  readonly totalSales: number;
  readonly grossSales: number;
  readonly netSales: number;
  readonly costOfSales: number;
  readonly grossProfit: number;
  readonly discounts: number;
  readonly transactionCount: number;
};

/** Ventas del rango agregadas en centavos para una serie temporal. */
export type SalesTrendBucketCents = {
  totalSales: number;
  netSales: number;
  grossProfit: number;
  transactions: number;
};

/** Unidades, ingresos y ganancia de un producto, en centavos. */
export type TopProductAggregateCents = {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  revenue: number;
  profit: number;
};

/** Cobros de un método de pago, en centavos. */
export type PaymentMethodAggregateCents = {
  transactions: number;
  amount: number;
};

/** Inventario agregado en centavos y conteo de alertas. */
export type InventoryCents = {
  readonly inventoryValue: number;
  readonly lowStockCount: number;
  readonly outOfStockCount: number;
};

const datePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BOGOTA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Redondea a dos decimales (medio hacia arriba, admite negativos). */
export function round2(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('Valor monetario inválido');
  }

  return (
    (Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100)) /
    100
  );
}

/** Convierte un importe en pesos a centavos enteros. */
export function toCents(value: number): number {
  return Math.round(value * 100);
}

/** Convierte centavos enteros al importe en pesos que expone la API. */
export function fromCents(cents: number): number {
  return cents / 100;
}

function datePart(
  parts: readonly Intl.DateTimeFormatPart[],
  type: 'year' | 'month' | 'day',
): string {
  const part = parts.find((entry) => entry.type === type);

  if (!part) {
    throw new Error(`No se pudo resolver la parte ${type} de la fecha`);
  }

  return part.value;
}

/** Día calendario (`YYYY-MM-DD`) de una fecha UTC vista en `America/Bogota`. */
export function bogotaDay(date: Date): string {
  const parts = datePartsFormatter.formatToParts(date);

  return `${datePart(parts, 'year')}-${datePart(parts, 'month')}-${datePart(parts, 'day')}`;
}

/** Periodo de agrupación en `America/Bogota`; `week` cae al lunes local. */
export function bogotaPeriod(
  date: Date,
  granularity: TrendGranularity,
): string {
  const day = bogotaDay(date);

  if (granularity === 'day') {
    return day;
  }

  if (granularity === 'month') {
    return day.slice(0, 7);
  }

  // `Date.UTC` sobre el día local y luego retroceso al lunes de esa semana.
  const utc = Date.UTC(
    Number(day.slice(0, 4)),
    Number(day.slice(5, 7)) - 1,
    Number(day.slice(8, 10)),
  );
  const offset = (new Date(utc).getUTCDay() + 6) % 7;

  return new Date(utc - offset * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Suma los totales de las ventas del rango; el conteo incrementa por fila. */
export function sumSaleTotals(
  rows: readonly {
    readonly subtotal: DecimalValue;
    readonly discountAmount: DecimalValue;
    readonly taxAmount: DecimalValue;
    readonly total: DecimalValue;
    readonly costTotal: DecimalValue;
    readonly profit: DecimalValue;
  }[],
): SalesTotalsCents {
  return rows.reduce<SalesTotalsCents>(
    (acc, row) => {
      const total = toCents(row.total.toNumber());
      const tax = toCents(row.taxAmount.toNumber());

      return {
        totalSales: acc.totalSales + total,
        grossSales: acc.grossSales + toCents(row.subtotal.toNumber()),
        netSales: acc.netSales + (total - tax),
        costOfSales: acc.costOfSales + toCents(row.costTotal.toNumber()),
        grossProfit: acc.grossProfit + toCents(row.profit.toNumber()),
        discounts: acc.discounts + toCents(row.discountAmount.toNumber()),
        transactionCount: acc.transactionCount + 1,
      };
    },
    {
      totalSales: 0,
      grossSales: 0,
      netSales: 0,
      costOfSales: 0,
      grossProfit: 0,
      discounts: 0,
      transactionCount: 0,
    },
  );
}

/** Mermas en centavos: ajustes negativos valorizados a su costo unitario. */
export function sumShrinkageCents(
  rows: readonly {
    readonly quantity: number;
    readonly unitCost: DecimalValue;
  }[],
): number {
  return rows.reduce(
    (acc, row) =>
      acc + Math.abs(row.quantity) * toCents(row.unitCost.toNumber()),
    0,
  );
}

/** Valorización del inventario en centavos y alertas de reposición. */
export function sumInventory(
  rows: readonly {
    readonly stock: number;
    readonly minStock: number;
    readonly costPrice: DecimalValue;
  }[],
): InventoryCents {
  let inventoryValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const product of rows) {
    inventoryValue += product.stock * toCents(product.costPrice.toNumber());

    if (product.stock === 0) {
      outOfStockCount += 1;
    }

    if (product.stock <= product.minStock) {
      lowStockCount += 1;
    }
  }

  return { inventoryValue, lowStockCount, outOfStockCount };
}

/** Margen bruto sobre ventas netas, en porcentaje con dos decimales. */
export function marginPercent(
  netSalesCents: number,
  grossProfitCents: number,
): number {
  if (netSalesCents === 0) {
    return 0;
  }

  return round2((grossProfitCents / netSalesCents) * 100);
}

/** Ticket promedio en COP con dos decimales; `0` si no hubo ventas. */
export function averageTicket(
  totalSalesCents: number,
  transactions: number,
): number {
  if (transactions === 0) {
    return 0;
  }

  return round2(fromCents(totalSalesCents) / transactions);
}

/** Rango efectivo expuesto en las respuestas. */
export function toRangeResponse(
  from: Date,
  to: Date,
): DashboardRangeResponseDto {
  return { from: from.toISOString(), to: to.toISOString() };
}

export function toSalesTrendPointDto(
  period: string,
  bucket: SalesTrendBucketCents,
): SalesTrendPointDto {
  return {
    period,
    totalSales: fromCents(bucket.totalSales),
    netSales: fromCents(bucket.netSales),
    grossProfit: fromCents(bucket.grossProfit),
    transactions: bucket.transactions,
  };
}

export function toTopProductItemDto(
  aggregate: TopProductAggregateCents,
): TopProductItemDto {
  return {
    productId: aggregate.productId,
    name: aggregate.name,
    sku: aggregate.sku,
    quantity: aggregate.quantity,
    revenue: fromCents(aggregate.revenue),
    profit: fromCents(aggregate.profit),
  };
}

export function toPaymentMethodBreakdownDto(
  method: PaymentMethod,
  aggregate: PaymentMethodAggregateCents,
): PaymentMethodBreakdownDto {
  return {
    method,
    transactions: aggregate.transactions,
    amount: fromCents(aggregate.amount),
  };
}

export function toDashboardLowStockItemDto(product: {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly stock: number;
  readonly minStock: number;
  readonly unit: string;
}): DashboardLowStockItemDto {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    stock: product.stock,
    minStock: product.minStock,
    deficit: Math.max(0, product.minStock - product.stock),
    unit: product.unit,
  };
}
