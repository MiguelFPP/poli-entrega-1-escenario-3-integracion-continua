import { PaymentMethod, SaleStatus } from '../../generated/prisma/client.js';
import type {
  PaymentGetPayload,
  PaymentSelect,
  SaleGetPayload,
  SaleInclude,
  SaleItemGetPayload,
  SaleItemSelect,
  UserSelect,
} from '../../generated/prisma/models.js';
import type { PaymentMethodName } from './dto/create-sale.dto.js';
import type { SaleStatusName } from './dto/query-sales.dto.js';
import type {
  SaleDetailDto,
  SaleItemResponseDto,
  SalePaymentResponseDto,
  SaleSummaryDto,
  SaleUserDto,
} from './dto/sale-response.dto.js';

/** Traduce el filtro de texto al enum de Prisma. */
export const SALE_STATUS_VALUES: Record<SaleStatusName, SaleStatus> = {
  COMPLETED: SaleStatus.COMPLETED,
  VOIDED: SaleStatus.VOIDED,
};

/** Traduce el método de pago del DTO al enum de Prisma. */
export const PAYMENT_METHOD_VALUES: Record<PaymentMethodName, PaymentMethod> = {
  CASH: PaymentMethod.CASH,
  CARD: PaymentMethod.CARD,
};

/** Usuario (resumen) embebido en toda lectura de venta. */
export const SALE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
} as const satisfies UserSelect;

/** Snapshot de la línea: el producto puede cambiar después de la venta. */
export const SALE_ITEM_SELECT = {
  id: true,
  productId: true,
  productName: true,
  sku: true,
  quantity: true,
  unitPrice: true,
  unitCost: true,
  lineSubtotal: true,
  lineDiscount: true,
  lineTax: true,
  lineTotal: true,
  lineProfit: true,
} as const satisfies SaleItemSelect;

export const SALE_PAYMENT_SELECT = {
  id: true,
  method: true,
  amount: true,
  cashReceived: true,
  changeGiven: true,
  createdAt: true,
} as const satisfies PaymentSelect;

/** Cabecera con lo mínimo para el listado: sin líneas. */
export const SALE_SUMMARY_INCLUDE = {
  user: { select: SALE_USER_SELECT },
  payments: { select: { method: true }, take: 1 },
  _count: { select: { items: true } },
} as const satisfies SaleInclude;

/** Detalle completo: líneas, pago, usuario y anulación. */
export const SALE_DETAIL_INCLUDE = {
  user: { select: SALE_USER_SELECT },
  voidedBy: { select: SALE_USER_SELECT },
  payments: { select: SALE_PAYMENT_SELECT },
  items: { select: SALE_ITEM_SELECT },
} as const satisfies SaleInclude;

export type SaleItemRecord = SaleItemGetPayload<{
  select: typeof SALE_ITEM_SELECT;
}>;

export type SalePaymentRecord = PaymentGetPayload<{
  select: typeof SALE_PAYMENT_SELECT;
}>;

export type SaleUserRecord = {
  id: string;
  name: string;
  email: string;
};

export type SaleSummaryRecord = SaleGetPayload<{
  include: typeof SALE_SUMMARY_INCLUDE;
}>;

export type SaleDetailRecord = SaleGetPayload<{
  include: typeof SALE_DETAIL_INCLUDE;
}>;

/** Campos compartidos entre el resumen y el detalle de una venta. */
type SaleSummarySource = {
  readonly id: string;
  readonly number: bigint;
  readonly status: SaleStatus;
  readonly total: { toNumber(): number };
  readonly createdAt: Date;
  readonly voidedAt: Date | null;
  readonly user: SaleUserRecord;
};

/** Número consecutivo visible de la venta: `V-000001`. */
export function formatSaleNumber(number: bigint): string {
  return `V-${number.toString().padStart(6, '0')}`;
}

function toSaleUserDto(user: SaleUserRecord): SaleUserDto {
  return { id: user.id, name: user.name, email: user.email };
}

function toSaleItemDto(item: SaleItemRecord): SaleItemResponseDto {
  return {
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    sku: item.sku,
    quantity: item.quantity,
    unitPrice: item.unitPrice.toNumber(),
    unitCost: item.unitCost.toNumber(),
    lineSubtotal: item.lineSubtotal.toNumber(),
    lineDiscount: item.lineDiscount.toNumber(),
    lineTax: item.lineTax.toNumber(),
    lineTotal: item.lineTotal.toNumber(),
    lineProfit: item.lineProfit.toNumber(),
  };
}

function toSalePaymentDto(payment: SalePaymentRecord): SalePaymentResponseDto {
  return {
    id: payment.id,
    method: payment.method,
    amount: payment.amount.toNumber(),
    cashReceived: payment.cashReceived?.toNumber() ?? null,
    changeGiven: payment.changeGiven?.toNumber() ?? null,
    createdAt: payment.createdAt.toISOString(),
  };
}

function toSaleSummary(
  sale: SaleSummarySource,
  itemCount: number,
  paymentMethod: PaymentMethod | null,
): SaleSummaryDto {
  return {
    id: sale.id,
    number: formatSaleNumber(sale.number),
    status: sale.status,
    total: sale.total.toNumber(),
    itemCount,
    paymentMethod,
    createdAt: sale.createdAt.toISOString(),
    voidedAt: sale.voidedAt?.toISOString() ?? null,
    user: toSaleUserDto(sale.user),
  };
}

export function toSaleSummaryDto(sale: SaleSummaryRecord): SaleSummaryDto {
  return toSaleSummary(
    sale,
    sale._count.items,
    sale.payments[0]?.method ?? null,
  );
}

export function toSaleDetailDto(sale: SaleDetailRecord): SaleDetailDto {
  const items = sale.items.map((item) => toSaleItemDto(item));
  const payment = sale.payments[0] ?? null;

  return {
    ...toSaleSummary(sale, items.length, payment?.method ?? null),
    subtotal: sale.subtotal.toNumber(),
    discountAmount: sale.discountAmount.toNumber(),
    taxAmount: sale.taxAmount.toNumber(),
    costTotal: sale.costTotal.toNumber(),
    profit: sale.profit.toNumber(),
    voidReason: sale.voidReason,
    voidedBy: sale.voidedBy ? toSaleUserDto(sale.voidedBy) : null,
    items,
    payment: payment ? toSalePaymentDto(payment) : null,
  };
}
