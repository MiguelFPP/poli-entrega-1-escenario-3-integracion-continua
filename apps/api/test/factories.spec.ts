import { faker } from '@faker-js/faker';
import {
  PaymentMethod,
  PriceField,
  Role,
  SaleStatus,
  StockMovementType,
} from '../src/generated/prisma/client.js';
import {
  buildCategory,
  buildPayment,
  buildPriceHistory,
  buildProduct,
  buildSale,
  buildSaleItem,
  buildStockMovement,
  buildUser,
  computeItemTotals,
  computeSaleTotals,
  distributeDiscount,
  round2,
  taxFromGross,
  type SaleLineInput,
} from '../prisma/factories/index.js';

beforeAll(() => {
  faker.seed(2026);
});

function line(overrides: Partial<SaleLineInput> = {}): SaleLineInput {
  return {
    productId: faker.string.uuid(),
    productName: 'Producto demo',
    sku: 'SKU-DEMO',
    quantity: 1,
    unitPrice: 10_000,
    unitCost: 6_000,
    ...overrides,
  };
}

describe('builders de entidades', () => {
  it('buildUser genera un administrador activo con hash bcrypt', () => {
    const user = buildUser();

    expect(user.role).toBe(Role.ADMIN);
    expect(user.active).toBe(true);
    expect(user.email).toMatch(/@pos\.local$/);
    expect(user.passwordHash).toHaveLength(60);
    expect(user.passwordHash.startsWith('$2b$')).toBe(true);
    expect(user.name.length).toBeGreaterThan(0);
  });

  it('buildUser respeta los overrides', () => {
    const user = buildUser({
      email: 'cajera@pos.local',
      role: Role.CASHIER,
      active: false,
    });

    expect(user).toMatchObject({
      email: 'cajera@pos.local',
      role: Role.CASHIER,
      active: false,
    });
  });

  it('buildCategory genera nombre único y activo', () => {
    const category = buildCategory();

    expect(category.name.length).toBeGreaterThan(0);
    expect(category.active).toBe(true);
    expect(category.description).toBeTruthy();
  });

  it('buildProduct mantiene precios coherentes y stock no negativo', () => {
    const product = buildProduct();

    expect(product.costPrice).toBeGreaterThan(0);
    expect(product.salePrice).toBeGreaterThanOrEqual(product.costPrice);
    expect(product.salePrice % 1).toBe(0);
    expect(Number.isInteger(product.stock)).toBe(true);
    expect(product.stock).toBeGreaterThanOrEqual(0);
    expect(product.barcode).toMatch(/^\d{13}$/);
    expect(product.unit).toBe('unidad');
    expect(product.deletedAt).toBeNull();
  });

  it('buildProduct admite barcode nulo y overrides explícitos', () => {
    const product = buildProduct({
      barcode: null,
      sku: 'SKU-FIJO',
      costPrice: 1_000,
      salePrice: 1_500,
    });

    expect(product.barcode).toBeNull();
    expect(product.sku).toBe('SKU-FIJO');
    expect(product.salePrice).toBe(1_500);
  });

  it('buildPriceHistory registra el campo y el valor nuevo', () => {
    const history = buildPriceHistory({ oldValue: 10_000 });

    expect(history.field).toBe(PriceField.SALE);
    expect(history.oldValue).toBe(10_000);
    expect(history.newValue).toBe(11_000);
    expect(history.createdAt).toBeInstanceOf(Date);
  });

  it('buildStockMovement calcula el stock resultante', () => {
    const entry = buildStockMovement({ quantity: 12, previousStock: 30 });

    expect(entry.type).toBe(StockMovementType.ENTRY);
    expect(entry.newStock).toBe(42);

    const adjustment = buildStockMovement({ quantity: -4, previousStock: 30 });

    expect(adjustment.type).toBe(StockMovementType.ADJUSTMENT);
    expect(adjustment.newStock).toBe(26);
  });

  it('buildSaleItem replica los datos de la línea y sus totales', () => {
    const item = buildSaleItem(
      line({ quantity: 3, unitPrice: 4_500, unitCost: 3_000 }),
    );

    expect(item.quantity).toBe(3);
    expect(item.lineSubtotal).toBe(13_500);
    expect(item.lineTotal).toBe(13_500);
    expect(item.lineCost).toBe(9_000);
    expect(item.lineProfit).toBe(round2(13_500 - taxFromGross(13_500) - 9_000));
  });
});

describe('pagos', () => {
  it('efectivo devuelve cambio consistente', () => {
    const payment = buildPayment({
      method: PaymentMethod.CASH,
      amount: 12_300,
    });

    expect(payment.cashReceived).toBe(13_000);
    expect(payment.changeGiven).toBe(700);
    expect((payment.changeGiven ?? 0) + payment.amount).toBe(
      payment.cashReceived,
    );
  });

  it('efectivo nunca recibe menos que el total', () => {
    const payment = buildPayment({
      method: PaymentMethod.CASH,
      amount: 20_000,
      cashReceived: 5_000,
    });

    expect(payment.cashReceived).toBe(20_000);
    expect(payment.changeGiven).toBe(0);
  });

  it('tarjeta no registra efectivo ni cambio', () => {
    const payment = buildPayment({
      method: PaymentMethod.CARD,
      amount: 20_000,
    });

    expect(payment.cashReceived).toBeNull();
    expect(payment.changeGiven).toBeNull();
  });

  it('rechaza montos negativos', () => {
    expect(() => buildPayment({ amount: -1 })).toThrow(/monto >= 0/);
  });
});

describe('totales de venta', () => {
  it('round2 y taxFromGross usan dos decimales e IVA del 19 %', () => {
    expect(round2(10.999)).toBe(11);
    expect(round2(1_234.567)).toBe(1_234.57);
    expect(taxFromGross(11_900)).toBe(1_900);
  });

  it('distributeDiscount prorratea y cuadra la suma', () => {
    const discounts = distributeDiscount([10_000, 5_000, 3_333], 0.1);

    expect(discounts).toHaveLength(3);
    expect(round2(discounts.reduce((acc, value) => acc + value, 0))).toBe(
      round2((10_000 + 5_000 + 3_333) * 0.1),
    );
  });

  it('computeItemTotals aplica descuento e IVA incluido', () => {
    const totals = computeItemTotals(
      line({
        quantity: 2,
        unitPrice: 10_000,
        unitCost: 6_000,
        discount: 1_000,
      }),
    );

    expect(totals.lineSubtotal).toBe(20_000);
    expect(totals.lineDiscount).toBe(1_000);
    expect(totals.lineTotal).toBe(19_000);
    expect(totals.lineTax).toBe(round2(19_000 - 19_000 / 1.19));
    expect(totals.lineProfit).toBe(round2(19_000 - totals.lineTax - 12_000));
  });

  it('buildSale arma una venta coherente con descuento prorrateado', () => {
    const sale = buildSale({
      number: 7n,
      items: [
        line({ quantity: 2, unitPrice: 10_000, unitCost: 6_000 }),
        line({ quantity: 1, unitPrice: 5_000, unitCost: 3_000 }),
      ],
      discountRate: 0.1,
    });

    expect(sale.number).toBe(7n);
    expect(sale.status).toBe(SaleStatus.COMPLETED);
    expect(sale.subtotal).toBe(25_000);
    expect(sale.discountAmount).toBe(2_500);
    expect(sale.total).toBe(22_500);
    expect(sale.taxAmount).toBe(round2(22_500 - 22_500 / 1.19));
    expect(sale.costTotal).toBe(15_000);
    expect(sale.profit).toBe(round2(22_500 - sale.taxAmount - 15_000));
    expect(sale.items).toHaveLength(2);
    expect(sale.voidedAt).toBeNull();
  });

  it('los totales de las líneas cuadran con la venta', () => {
    const sale = buildSale({
      items: [line(), line({ quantity: 3, unitPrice: 2_333, unitCost: 1_500 })],
      discountRate: 0.05,
    });

    const itemsTotal = round2(
      sale.items.reduce((acc, item) => acc + item.lineTotal, 0),
    );
    const itemsDiscount = round2(
      sale.items.reduce((acc, item) => acc + item.lineDiscount, 0),
    );

    expect(itemsTotal).toBe(sale.total);
    expect(itemsDiscount).toBe(sale.discountAmount);
    expect(round2(sale.subtotal - sale.discountAmount)).toBe(sale.total);
  });

  it('el descuento explícito por línea tiene prioridad sobre discountRate', () => {
    const sale = buildSale({
      items: [line({ quantity: 1, discount: 2_000 })],
      discountRate: 0.5,
    });

    expect(sale.subtotal).toBe(10_000);
    expect(sale.discountAmount).toBe(2_000);
    expect(sale.total).toBe(8_000);
  });

  it('marca la venta como anulada cuando se pide', () => {
    const sale = buildSale({ items: [line()], status: SaleStatus.VOIDED });

    expect(sale.status).toBe(SaleStatus.VOIDED);
    expect(sale.voidedAt).toBeInstanceOf(Date);
  });

  it('nunca produce totales negativos con precios válidos', () => {
    for (let index = 0; index < 50; index += 1) {
      const unitCost = faker.number.int({ min: 500, max: 40_000 });
      const multiplier = faker.number.float({
        min: 1.5,
        max: 2.5,
        fractionDigits: 2,
      });
      const unitPrice = Math.ceil((unitCost * multiplier) / 100) * 100;
      const sale = buildSale({
        items: [line({ quantity: 1, unitPrice, unitCost })],
        discountRate: faker.helpers.arrayElement([0, 0.05, 0.1]),
      });

      expect(sale.total).toBeGreaterThanOrEqual(0);
      expect(sale.profit).toBeGreaterThanOrEqual(0);
      expect(sale.subtotal).toBeGreaterThanOrEqual(sale.total);
    }
  });

  it('rechaza líneas inválidas', () => {
    expect(() => computeItemTotals(line({ quantity: 0 }))).toThrow(
      /entero > 0/,
    );
    expect(() => computeItemTotals(line({ quantity: 1.5 }))).toThrow(
      /entero > 0/,
    );
    expect(() => computeItemTotals(line({ unitPrice: -1 }))).toThrow(
      /unitPrice/,
    );
    expect(() => computeItemTotals(line({ discount: 20_000 }))).toThrow(
      /no puede superar/,
    );
    expect(() => distributeDiscount([1_000], 1)).toThrow(/discountRate/);
    expect(computeSaleTotals([]).total).toBe(0);
  });
});
