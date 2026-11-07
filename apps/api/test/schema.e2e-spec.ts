import { faker } from '@faker-js/faker';
import {
  PaymentMethod,
  SaleStatus,
  StockMovementType,
  type PrismaClient,
} from '../src/generated/prisma/client.js';
import {
  createPriceHistory,
  createProduct,
  createSale,
  createUser,
  nextSaleNumber,
  type SaleLineInput,
} from '../prisma/factories/index.js';
import { resetDatabase, setupTestDatabase } from './db.js';

faker.seed(2026);

describe('Esquema de la base de datos (e2e)', () => {
  let client: PrismaClient;

  beforeAll(async () => {
    client = await setupTestDatabase();
  }, 30000);

  beforeEach(async () => {
    await resetDatabase(client);
  });

  afterAll(async () => {
    if (client) {
      await client.$disconnect();
    }
  });

  it('crea todas las tablas del dominio', async () => {
    const rows = await client.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `;
    const tables = rows.map((row) => row.table_name);

    expect(tables).toEqual(
      expect.arrayContaining([
        'users',
        'refresh_tokens',
        'categories',
        'products',
        'price_history',
        'stock_movements',
        'sales',
        'sale_items',
        'payments',
      ]),
    );
  });

  it('crea los enums del dominio', async () => {
    const rows = await client.$queryRaw<Array<{ typname: string }>>`
      SELECT typname FROM pg_type WHERE typtype = 'e'
    `;
    const enums = rows.map((row) => row.typname);

    expect(enums).toEqual(
      expect.arrayContaining([
        'Role',
        'PriceField',
        'StockMovementType',
        'SaleStatus',
        'PaymentMethod',
      ]),
    );
  });

  it('mapea las columnas en camelCase', async () => {
    const rows = await client.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'users'
    `;
    const columns = rows.map((row) => row.column_name);

    expect(columns).toEqual(
      expect.arrayContaining(['id', 'passwordHash', 'createdAt']),
    );
  });

  it('existe la secuencia sale_number_seq y arranca en 1', async () => {
    const sequences = await client.$queryRaw<Array<{ sequence_name: string }>>`
      SELECT sequence_name FROM information_schema.sequences WHERE sequence_name = 'sale_number_seq'
    `;

    expect(sequences).toHaveLength(1);

    const first = await nextSaleNumber(client);
    const second = await nextSaleNumber(client);

    expect(first).toBe(1n);
    expect(second).toBe(2n);
  });

  it('el email de usuario es único', async () => {
    await createUser(client, { email: 'duplicado@pos.local' });

    await expect(
      createUser(client, { email: 'duplicado@pos.local' }),
    ).rejects.toThrow();
  });

  it('el sku y el barcode de producto son únicos', async () => {
    const product = await createProduct(client, {
      sku: 'SKU-UNICO',
      barcode: '7709000000001',
    });

    await expect(
      createProduct(client, {
        sku: 'SKU-UNICO',
        categoryId: product.categoryId,
      }),
    ).rejects.toThrow();
    await expect(
      createProduct(client, {
        sku: 'SKU-OTRO',
        barcode: '7709000000001',
        categoryId: product.categoryId,
      }),
    ).rejects.toThrow();
  });

  it('el número de venta es único y sale de sale_number_seq', async () => {
    const first = await createSale(client);
    const second = await createSale(client);

    expect(first.sale.number).toBe(1n);
    expect(second.sale.number).toBe(2n);

    await expect(
      client.sale.update({
        where: { id: second.sale.id },
        data: { number: first.sale.number },
      }),
    ).rejects.toThrow();
  });

  it('rechaza stock negativo en productos', async () => {
    const product = await createProduct(client, { stock: 5 });

    await expect(
      client.product.update({ where: { id: product.id }, data: { stock: -1 } }),
    ).rejects.toThrow(/check|constraint/i);
  });

  it('rechaza precios negativos en productos', async () => {
    const product = await createProduct(client);

    await expect(
      client.product.update({
        where: { id: product.id },
        data: { costPrice: -1 },
      }),
    ).rejects.toThrow();
    await expect(
      client.product.update({
        where: { id: product.id },
        data: { salePrice: -1 },
      }),
    ).rejects.toThrow();
  });

  it('rechaza cantidades no positivas en ítems de venta', async () => {
    const created = await createSale(client);
    const [item] = created.items;

    if (!item) {
      throw new Error('La venta de prueba no generó ítems');
    }

    await expect(
      client.saleItem.update({ where: { id: item.id }, data: { quantity: 0 } }),
    ).rejects.toThrow();
  });

  it('rechaza totales negativos en ventas', async () => {
    const created = await createSale(client);

    await expect(
      client.sale.update({
        where: { id: created.sale.id },
        data: { total: -1 },
      }),
    ).rejects.toThrow();
  });

  it('crea ventas con ítems, pago y movimientos de stock coherentes', async () => {
    const product = await createProduct(client, {
      stock: 20,
      costPrice: 5_000,
      salePrice: 9_000,
    });
    const other = await createProduct(client, {
      stock: 15,
      costPrice: 2_000,
      salePrice: 3_500,
    });

    const items: SaleLineInput[] = [
      {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: 2,
        unitPrice: product.salePrice,
        unitCost: product.costPrice,
      },
      {
        productId: other.id,
        productName: other.name,
        sku: other.sku,
        quantity: 3,
        unitPrice: other.salePrice,
        unitCost: other.costPrice,
      },
    ];

    const created = await createSale(client, {
      items,
      withStockMovements: true,
      paymentMethod: PaymentMethod.CASH,
    });

    expect(created.items).toHaveLength(2);
    expect(Number(created.payment.amount)).toBe(Number(created.sale.total));
    expect(created.movements).toHaveLength(2);
    expect(
      created.movements.every(
        (movement) => movement.type === StockMovementType.SALE,
      ),
    ).toBe(true);

    const refreshed = await client.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(refreshed.stock).toBe(18);
  });

  it('anular una venta restaura el stock', async () => {
    const product = await createProduct(client, {
      stock: 10,
      costPrice: 1_000,
      salePrice: 2_000,
    });

    const created = await createSale(client, {
      items: [
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: 4,
          unitPrice: product.salePrice,
          unitCost: product.costPrice,
        },
      ],
      withStockMovements: true,
      voided: true,
    });

    expect(created.sale.status).toBe(SaleStatus.VOIDED);
    expect(created.sale.voidedAt).toBeInstanceOf(Date);

    const refreshed = await client.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(refreshed.stock).toBe(10);
    expect(created.movements.map((movement) => movement.type)).toEqual([
      StockMovementType.SALE,
      StockMovementType.VOID,
    ]);
  });

  it('borrar un usuario elimina sus refresh tokens (Cascade)', async () => {
    const user = await createUser(client);
    const token = await client.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: `hash-${faker.string.uuid()}`,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    await client.user.delete({ where: { id: user.id } });

    expect(await client.refreshToken.count({ where: { id: token.id } })).toBe(
      0,
    );
  });

  it('borrar una venta elimina ítems y pago y deja el movimiento sin venta', async () => {
    const created = await createSale(client, { withStockMovements: true });

    await client.sale.delete({ where: { id: created.sale.id } });

    expect(
      await client.saleItem.count({ where: { saleId: created.sale.id } }),
    ).toBe(0);
    expect(
      await client.payment.count({ where: { saleId: created.sale.id } }),
    ).toBe(0);

    const [movement] = created.movements;
    if (!movement) {
      throw new Error('La venta de prueba no generó movimientos de stock');
    }

    const refreshedMovement = await client.stockMovement.findUniqueOrThrow({
      where: { id: movement.id },
    });
    expect(refreshedMovement.saleId).toBeNull();
  });

  it('borrar un producto elimina su historial de precios (Cascade)', async () => {
    const product = await createProduct(client);
    await createPriceHistory(client, {
      productId: product.id,
      oldValue: 1_000,
      newValue: 1_200,
    });

    await client.product.delete({ where: { id: product.id } });

    expect(
      await client.priceHistory.count({ where: { productId: product.id } }),
    ).toBe(0);
  });
});
