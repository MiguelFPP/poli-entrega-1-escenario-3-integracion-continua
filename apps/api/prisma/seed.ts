import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import { Role } from '../src/generated/prisma/client.js';
import { createPrismaClient, disconnectQuietly } from './client.js';

// Semilla fija: los datos generados son reproducibles.
faker.seed(2026);

const BCRYPT_ROUNDS = 12;

const ADMIN = {
  name: 'Administrador POS',
  email: 'admin@pos.local',
  password: 'Admin123!',
  role: Role.ADMIN,
} as const;

type SeedCategory = {
  name: string;
  description: string;
};

type SeedProduct = {
  sku: string;
  barcode: string;
  name: string;
  category: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  unit: string;
};

const CATEGORIES: readonly SeedCategory[] = [
  { name: 'Bebidas', description: 'Bebidas frías y calientes' },
  { name: 'Snacks', description: 'Mecato y pasabocas' },
  { name: 'Lácteos', description: 'Leche, queso y derivados' },
  { name: 'Panadería', description: 'Pan y productos de horno' },
  { name: 'Aseo', description: 'Cuidado personal y limpieza' },
  { name: 'Abarrotes', description: 'Despensa y granos' },
];

const PRODUCTS: readonly SeedProduct[] = [
  {
    sku: 'BEB-001',
    barcode: '7701000000011',
    name: 'Agua Cristal 600 ml',
    category: 'Bebidas',
    costPrice: 1200,
    salePrice: 2000,
    stock: 96,
    minStock: 24,
    unit: 'botella',
  },
  {
    sku: 'BEB-002',
    barcode: '7701000000028',
    name: 'Gaseosa Coca-Cola 400 ml',
    category: 'Bebidas',
    costPrice: 2200,
    salePrice: 3500,
    stock: 72,
    minStock: 18,
    unit: 'botella',
  },
  {
    sku: 'BEB-003',
    barcode: '7701000000035',
    name: 'Jugo Hit Mora 500 ml',
    category: 'Bebidas',
    costPrice: 1800,
    salePrice: 3000,
    stock: 60,
    minStock: 12,
    unit: 'botella',
  },
  {
    sku: 'BEB-004',
    barcode: '7701000000042',
    name: 'Café Águila Roja 500 g',
    category: 'Bebidas',
    costPrice: 9800,
    salePrice: 14500,
    stock: 40,
    minStock: 10,
    unit: 'bolsa',
  },
  {
    sku: 'SNK-001',
    barcode: '7701000000059',
    name: 'Papas Margarita Pollo 105 g',
    category: 'Snacks',
    costPrice: 2600,
    salePrice: 4200,
    stock: 85,
    minStock: 20,
    unit: 'paquete',
  },
  {
    sku: 'SNK-002',
    barcode: '7701000000066',
    name: 'Chocolate Jet 30 g',
    category: 'Snacks',
    costPrice: 1300,
    salePrice: 2200,
    stock: 120,
    minStock: 30,
    unit: 'unidad',
  },
  {
    sku: 'LAC-001',
    barcode: '7701000000073',
    name: 'Leche Alquería Entera 1 L',
    category: 'Lácteos',
    costPrice: 3400,
    salePrice: 4800,
    stock: 64,
    minStock: 16,
    unit: 'bolsa',
  },
  {
    sku: 'LAC-002',
    barcode: '7701000000080',
    name: 'Queso Campesino 250 g',
    category: 'Lácteos',
    costPrice: 6200,
    salePrice: 8900,
    stock: 30,
    minStock: 8,
    unit: 'unidad',
  },
  {
    sku: 'PAN-001',
    barcode: '7701000000097',
    name: 'Pan Tajado Bimbo 500 g',
    category: 'Panadería',
    costPrice: 5200,
    salePrice: 7400,
    stock: 36,
    minStock: 10,
    unit: 'unidad',
  },
  {
    sku: 'ASE-001',
    barcode: '7701000000103',
    name: 'Jabón Rey 300 g',
    category: 'Aseo',
    costPrice: 2900,
    salePrice: 4200,
    stock: 48,
    minStock: 12,
    unit: 'unidad',
  },
  {
    sku: 'ABA-001',
    barcode: '7701000000110',
    name: 'Arroz Diana 1 kg',
    category: 'Abarrotes',
    costPrice: 3600,
    salePrice: 5200,
    stock: 90,
    minStock: 20,
    unit: 'bolsa',
  },
  {
    sku: 'ABA-002',
    barcode: '7701000000127',
    name: 'Aceite Girasol 1 L',
    category: 'Abarrotes',
    costPrice: 8900,
    salePrice: 12500,
    stock: 42,
    minStock: 10,
    unit: 'botella',
  },
];

async function main(): Promise<void> {
  const client = createPrismaClient();

  try {
    const passwordHash = await bcrypt.hash(ADMIN.password, BCRYPT_ROUNDS);

    // Administrador idempotente: la contraseña se restablece en cada corrida.
    await client.user.upsert({
      where: { email: ADMIN.email },
      update: {
        name: ADMIN.name,
        passwordHash,
        role: ADMIN.role,
        active: true,
      },
      create: {
        name: ADMIN.name,
        email: ADMIN.email,
        passwordHash,
        role: ADMIN.role,
        active: true,
      },
    });

    const categoryIds = new Map<string, string>();

    for (const category of CATEGORIES) {
      const record = await client.category.upsert({
        where: { name: category.name },
        update: { description: category.description, active: true },
        create: { name: category.name, description: category.description },
      });
      categoryIds.set(record.name, record.id);
    }

    for (const product of PRODUCTS) {
      const categoryId = categoryIds.get(product.category);
      if (!categoryId) {
        throw new Error(
          `Categoría desconocida en el seed: ${product.category}`,
        );
      }

      const data = {
        barcode: product.barcode,
        name: product.name,
        description: faker.commerce.productDescription(),
        categoryId,
        costPrice: product.costPrice,
        salePrice: product.salePrice,
        stock: product.stock,
        minStock: product.minStock,
        unit: product.unit,
        active: true,
        deletedAt: null,
      };

      await client.product.upsert({
        where: { sku: product.sku },
        update: data,
        create: { sku: product.sku, ...data },
      });
    }

    const [users, categories, products] = await Promise.all([
      client.user.count(),
      client.category.count(),
      client.product.count(),
    ]);

    console.log(
      `[seed] Listo: ${users} usuarios, ${categories} categorías, ${products} productos.`,
    );
    console.log(`[seed] Credenciales: ${ADMIN.email} / ${ADMIN.password}`);
  } catch (error) {
    console.error(
      '[seed] Error al sembrar datos:',
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  } finally {
    await disconnectQuietly(client);
  }
}

await main();
