import {
  PaymentMethod,
  type PrismaClient,
} from '../../src/generated/prisma/client.js';
import type { PaymentModel } from '../../src/generated/prisma/models.js';
import { factoryError } from './errors.js';
import { assertNonNegative, round2 } from './money.js';

export type PaymentBuildInput = {
  method?: PaymentMethod;
  amount?: number;
  cashReceived?: number | null;
  changeGiven?: number | null;
};

export type PaymentBuildData = {
  method: PaymentMethod;
  amount: number;
  cashReceived: number | null;
  changeGiven: number | null;
};

/** Construye los datos de un pago coherente con su método. */
export function buildPayment(
  overrides: PaymentBuildInput = {},
): PaymentBuildData {
  const method = overrides.method ?? PaymentMethod.CASH;
  const amount = round2(overrides.amount ?? 10_000);
  assertNonNegative('payment.amount', amount);

  if (method === PaymentMethod.CARD) {
    return {
      method,
      amount,
      cashReceived: overrides.cashReceived ?? null,
      changeGiven: overrides.changeGiven ?? null,
    };
  }

  // Efectivo: se recibe en billetes de 1 000 y se devuelve el cambio.
  const rawReceived =
    overrides.cashReceived ?? Math.ceil(amount / 1_000) * 1_000;
  const cashReceived = round2(Math.max(rawReceived, amount));

  return {
    method,
    amount,
    cashReceived,
    changeGiven: round2(cashReceived - amount),
  };
}

export type CreatePaymentOptions = PaymentBuildInput & {
  /** Venta (única) a la que pertenece el pago. */
  saleId: string;
};

export async function createPayment(
  client: PrismaClient,
  options: CreatePaymentOptions,
): Promise<PaymentModel> {
  const { saleId, ...overrides } = options;

  try {
    return await client.payment.upsert({
      where: { saleId },
      update: buildPayment(overrides),
      create: { saleId, ...buildPayment(overrides) },
    });
  } catch (error) {
    throw factoryError('createPayment', error);
  }
}
