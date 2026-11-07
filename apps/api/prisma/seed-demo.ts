import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import {
  PaymentMethod,
  PriceField,
  Role,
  StockMovementType,
} from '../src/generated/prisma/client.js';
import { createPrismaClient, disconnectQuietly } from './client.js';
import {
  createCategory,
  createPriceHistory,
  createProduct,
  createSale,
  createStockMovement,
  createUser,
  round2,
  type SaleLineInput,
} from './factories/index.js';
import { truncateBusinessData } from './truncate.js';

// Semilla fija: el demo se regenera igual en cada corrida.
faker.seed(2026);

const BCRYPT_ROUNDS = 12;
const TOTAL_SALES = 40;
const TOTAL_PRODUCTS_PER_CATEGORY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

type CatalogCategory = {
  name: string;
  description: string;
  products: readonly CatalogProduct[];
};

type CatalogProduct = {
  name: string;
  costPrice: number;
  salePrice: number;
  unit: string;
};

const CATALOG: readonly CatalogCategory[] = [
  {
    name: 'Bebidas',
    description: 'Bebidas frías y calientes',
    products: [
      {
        name: 'Agua Cristal 600 ml',
        costPrice: 1200,
        salePrice: 2000,
        unit: 'botella',
      },
      {
        name: 'Gaseosa Coca-Cola 400 ml',
        costPrice: 2200,
        salePrice: 3500,
        unit: 'botella',
      },
      {
        name: 'Gaseosa Postobón Manzana 400 ml',
        costPrice: 2100,
        salePrice: 3300,
        unit: 'botella',
      },
      {
        name: 'Jugo Hit Mora 500 ml',
        costPrice: 1800,
        salePrice: 3000,
        unit: 'botella',
      },
      {
        name: 'Café Águila Roja 500 g',
        costPrice: 9800,
        salePrice: 14500,
        unit: 'bolsa',
      },
    ],
  },
  {
    name: 'Snacks',
    description: 'Mecato y pasabocas',
    products: [
      {
        name: 'Papas Margarita Pollo 105 g',
        costPrice: 2600,
        salePrice: 4200,
        unit: 'paquete',
      },
      {
        name: 'De Todito 90 g',
        costPrice: 2500,
        salePrice: 4000,
        unit: 'paquete',
      },
      {
        name: 'Chocolate Jet 30 g',
        costPrice: 1300,
        salePrice: 2200,
        unit: 'unidad',
      },
      {
        name: 'Chocorramo 65 g',
        costPrice: 1900,
        salePrice: 3000,
        unit: 'unidad',
      },
      {
        name: 'Maní Japones 80 g',
        costPrice: 1400,
        salePrice: 2400,
        unit: 'paquete',
      },
    ],
  },
  {
    name: 'Lácteos',
    description: 'Leche, queso y derivados',
    products: [
      {
        name: 'Leche Alquería Entera 1 L',
        costPrice: 3400,
        salePrice: 4800,
        unit: 'bolsa',
      },
      {
        name: 'Queso Campesino 250 g',
        costPrice: 6200,
        salePrice: 8900,
        unit: 'unidad',
      },
      {
        name: 'Yogurt Alpina Fresa 900 g',
        costPrice: 6800,
        salePrice: 9500,
        unit: 'unidad',
      },
      {
        name: 'Mantequilla Rama 250 g',
        costPrice: 4200,
        salePrice: 6300,
        unit: 'unidad',
      },
      {
        name: 'Kumis Alpina 1 L',
        costPrice: 3900,
        salePrice: 5600,
        unit: 'bolsa',
      },
    ],
  },
  {
    name: 'Panadería',
    description: 'Pan y productos de horno',
    products: [
      {
        name: 'Pan Tajado Bimbo 500 g',
        costPrice: 5200,
        salePrice: 7400,
        unit: 'unidad',
      },
      {
        name: 'Pan Integral Bimbo 500 g',
        costPrice: 5600,
        salePrice: 7900,
        unit: 'unidad',
      },
      {
        name: 'Croissant de mantequilla',
        costPrice: 1200,
        salePrice: 2500,
        unit: 'unidad',
      },
      {
        name: 'Mogolla tradicional',
        costPrice: 900,
        salePrice: 1800,
        unit: 'unidad',
      },
      {
        name: 'Tostadas Bimbo 240 g',
        costPrice: 3100,
        salePrice: 4600,
        unit: 'paquete',
      },
    ],
  },
  {
    name: 'Aseo',
    description: 'Cuidado personal y limpieza',
    products: [
      {
        name: 'Jabón Rey 300 g',
        costPrice: 2900,
        salePrice: 4200,
        unit: 'unidad',
      },
      {
        name: 'Papel Higiénico Familia 4 rollos',
        costPrice: 5800,
        salePrice: 8400,
        unit: 'paquete',
      },
      {
        name: 'Detergente Fab 900 g',
        costPrice: 7400,
        salePrice: 10500,
        unit: 'bolsa',
      },
      {
        name: 'Shampoo Sedal 375 ml',
        costPrice: 8900,
        salePrice: 12900,
        unit: 'botella',
      },
      {
        name: 'Crema Dental Colgate 75 ml',
        costPrice: 4300,
        salePrice: 6500,
        unit: 'unidad',
      },
    ],
  },
  {
    name: 'Abarrotes',
    description: 'Despensa y granos',
    products: [
      {
        name: 'Arroz Diana 1 kg',
        costPrice: 3600,
        salePrice: 5200,
        unit: 'bolsa',
      },
      {
        name: 'Aceite Girasol 1 L',
        costPrice: 8900,
        salePrice: 12500,
        unit: 'botella',
      },
      {
        name: 'Panela 500 g',
        costPrice: 2400,
        salePrice: 3500,
        unit: 'unidad',
      },
      {
        name: 'Lentejas 500 g',
        costPrice: 3200,
        salePrice: 4700,
        unit: 'bolsa',
      },
      {
        name: 'Atún Van Camps 170 g',
        costPrice: 4600,
        salePrice: 6900,
        unit: 'lata',
      },
    ],
  },
];

const VOID_REASONS: readonly string[] = [
  'Error de digitación',
  'Cliente desistió de la compra',
  'Pago no aprobado',
];

const ADJUSTMENT_REASONS: readonly string[] = [
  'Merma por vencimiento',
  'Producto averiado',
  'Ajuste de inventario físico',
];

/** Fecha de hace `daysAgo` días con una hora comercial estable. */
function saleDate(daysAgo: number, slot: number): Date {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  date.setTime(date.getTime() - daysAgo * DAY_MS);
  date.setHours(8 + (slot % 11), (slot * 7) % 60, 0, 0);
  return date;
}

async function main(): Promise<void> {
  const client = createPrismaClient();

  try {
    await truncateBusinessData(client);

    const passwordHash = await bcrypt.hash('Admin123!', BCRYPT_ROUNDS);
    const admin = await createUser(client, {
      name: 'Administrador POS',
      email: 'admin@pos.local',
      passwordHash,
      role: Role.ADMIN,
    });

    const products: {
      id: string;
      name: string;
      sku: string;
      unitPrice: number;
      unitCost: number;
    }[] = [];
    const stockById = new Map<string, number>();

    let index = 0;

    for (const category of CATALOG) {
      const record = await createCategory(client, {
        name: category.name,
        description: category.description,
      });

      const catalogProducts = category.products.slice(
        0,
        TOTAL_PRODUCTS_PER_CATEGORY,
      );

      for (const product of catalogProducts) {
        index += 1;
        const stock = 150 + (index % 5) * 20;
        const created = await createProduct(client, {
          sku: `DEMO-${String(index).padStart(3, '0')}`,
          barcode: `7702${String(index).padStart(9, '0')}`,
          name: product.name,
          description: `${product.name} — ${category.name.toLowerCase()}`,
          categoryId: record.id,
          costPrice: product.costPrice,
          salePrice: product.salePrice,
          stock,
          minStock: 20,
          unit: product.unit,
        });

        products.push({
          id: created.id,
          name: created.name,
          sku: created.sku,
          unitPrice: Number(created.salePrice),
          unitCost: Number(created.costPrice),
        });
        stockById.set(created.id, created.stock);
      }
    }

    let voidedCount = 0;

    for (let saleIndex = 0; saleIndex < TOTAL_SALES; saleIndex += 1) {
      const available = products.filter(
        (product) => (stockById.get(product.id) ?? 0) >= 3,
      );
      if (available.length === 0) {
        throw new Error(
          'Sin productos con stock suficiente para continuar el demo',
        );
      }

      const lineCount = Math.min(
        faker.number.int({ min: 1, max: 4 }),
        available.length,
      );
      const chosen = faker.helpers.shuffle(available).slice(0, lineCount);

      const items: SaleLineInput[] = chosen.map((product) => ({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: faker.number.int({ min: 1, max: 3 }),
        unitPrice: product.unitPrice,
        unitCost: product.unitCost,
      }));

      const voided = saleIndex % 6 === 5;
      const discountRate =
        saleIndex % 11 === 0 ? 0.1 : saleIndex % 7 === 0 ? 0.05 : 0;
      const paymentMethod =
        saleIndex % 3 === 2 ? PaymentMethod.CARD : PaymentMethod.CASH;

      await createSale(client, {
        userId: admin.id,
        items,
        discountRate,
        paymentMethod,
        createdAt: saleDate(saleIndex % 30, saleIndex),
        withStockMovements: true,
        voided,
        voidReason: voided
          ? faker.helpers.arrayElement(VOID_REASONS)
          : undefined,
      });

      if (voided) {
        voidedCount += 1;
      } else {
        for (const item of items) {
          const current = stockById.get(item.productId) ?? 0;
          stockById.set(item.productId, current - item.quantity);
        }
      }
    }

    // Mermas: ajustes negativos con su movimiento de inventario.
    const withStock = await client.product.findMany({
      where: { active: true, stock: { gte: 5 } },
      orderBy: { sku: 'asc' },
      take: 12,
    });

    const adjustmentTargets = faker.helpers.shuffle(withStock).slice(0, 5);

    for (const [offset, product] of adjustmentTargets.entries()) {
      await createStockMovement(client, {
        productId: product.id,
        quantity: -faker.number.int({ min: 1, max: 4 }),
        type: StockMovementType.ADJUSTMENT,
        reason: ADJUSTMENT_REASONS[offset % ADJUSTMENT_REASONS.length],
        userId: admin.id,
        createdAt: saleDate(offset + 1, offset + 5),
      });
    }

    // Historial de precios: sube el precio de venta de cinco productos.
    const priceTargets = faker.helpers.shuffle(withStock).slice(0, 5);

    for (const [offset, product] of priceTargets.entries()) {
      const oldValue = Number(product.salePrice);
      const newValue = round2(Math.ceil((oldValue * 1.1) / 100) * 100);

      await client.product.update({
        where: { id: product.id },
        data: { salePrice: newValue },
      });
      await createPriceHistory(client, {
        productId: product.id,
        field: PriceField.SALE,
        oldValue,
        newValue,
        changedById: admin.id,
        createdAt: saleDate(offset + 3, offset + 2),
      });
    }

    const [
      users,
      categories,
      totalProducts,
      sales,
      saleItems,
      payments,
      movements,
      history,
    ] = await Promise.all([
      client.user.count(),
      client.category.count(),
      client.product.count(),
      client.sale.count(),
      client.saleItem.count(),
      client.payment.count(),
      client.stockMovement.count(),
      client.priceHistory.count(),
    ]);

    console.log(
      [
        '[seed:demo] Listo.',
        `${users} usuarios`,
        `${categories} categorías`,
        `${totalProducts} productos`,
        `${sales} ventas (${voidedCount} anuladas)`,
        `${saleItems} ítems`,
        `${payments} pagos`,
        `${movements} movimientos de stock`,
        `${history} cambios de precio`,
      ].join(' '),
    );
    console.log('[seed:demo] Credenciales: admin@pos.local / Admin123!');
  } catch (error) {
    console.error(
      '[seed:demo] Error al generar el demo:',
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  } finally {
    await disconnectQuietly(client);
  }
}

await main();
