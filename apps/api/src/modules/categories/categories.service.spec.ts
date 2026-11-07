import { describe, expect, it, jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { CategoryWithCount } from './categories.mapper.js';
import { CategoriesService } from './categories.service.js';

const CATEGORY_ID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';
const OTHER_ID = '3d4e5f6a-7b8c-4d9e-8f0a-1b2c3d4e5f6a';

const TIMESTAMP = new Date('2026-02-10T14:30:00.000Z');

function categoryRecord(
  overrides: Partial<CategoryWithCount> = {},
): CategoryWithCount {
  return {
    id: CATEGORY_ID,
    name: 'Bebidas',
    description: 'Bebidas frías y calientes',
    active: true,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    _count: { products: 0 },
    ...overrides,
  };
}

function createMocks() {
  const findFirst = jest.fn<
    (args: {
      where: unknown;
      select?: unknown;
    }) => Promise<{ id: string } | null>
  >();
  const findUnique = jest.fn<
    (args: {
      where: { id: string };
      select?: unknown;
    }) => Promise<{ id: string } | null>
  >();
  const create = jest.fn<
    (args: {
      data: unknown;
      select?: unknown;
    }) => Promise<CategoryWithCount>
  >();
  const update = jest.fn<
    (args: {
      where: { id: string };
      data: unknown;
      select?: unknown;
    }) => Promise<CategoryWithCount>
  >();
  const findMany = jest.fn<
    (args: { where?: unknown; select?: unknown; orderBy?: unknown }) => Promise<
      CategoryWithCount[]
    >
  >();
  const count = jest.fn<(args: { where: unknown }) => Promise<number>>();

  const prisma = {
    category: { findFirst, findUnique, create, update, findMany },
    product: { count },
  } as unknown as PrismaService;

  return {
    service: new CategoriesService(prisma),
    findFirst,
    findUnique,
    create,
    update,
    findMany,
    count,
  };
}

describe('CategoriesService', () => {
  it('rechaza un nombre duplicado sin distinguir mayúsculas', async () => {
    const { service, findFirst, create } = createMocks();

    findFirst.mockResolvedValue({ id: OTHER_ID });

    await expect(service.create({ name: 'bebidas' })).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(findFirst).toHaveBeenCalledWith({
      where: { name: { equals: 'bebidas', mode: 'insensitive' } },
      select: { id: true },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('normaliza el nombre con trim antes de crear y de comprobar duplicados', async () => {
    const { service, findFirst, create } = createMocks();

    findFirst.mockResolvedValue(null);
    create.mockResolvedValue(categoryRecord({ name: 'Bebidas' }));

    const result = await service.create({ name: '  Bebidas  ' });

    expect(findFirst).toHaveBeenCalledWith({
      where: { name: { equals: 'Bebidas', mode: 'insensitive' } },
      select: { id: true },
    });

    const data = create.mock.calls[0]?.[0].data as {
      name: string;
      description: string | null;
      active: boolean;
    };

    expect(data).toMatchObject({ name: 'Bebidas', active: true });
    expect(result.name).toBe('Bebidas');
  });

  it('convierte una descripción vacía en null al actualizar', async () => {
    const { service, findUnique, findFirst, update } = createMocks();

    findUnique.mockResolvedValue({ id: CATEGORY_ID });
    findFirst.mockResolvedValue(null);
    update.mockResolvedValue(categoryRecord({ description: null }));

    await service.update(CATEGORY_ID, { description: '   ' });

    const data = update.mock.calls[0]?.[0].data as {
      description: string | null;
    };

    expect(data.description).toBeNull();
  });

  it('rechaza el borrado lógico si la categoría tiene productos activos', async () => {
    const { service, findUnique, count, update } = createMocks();

    findUnique.mockResolvedValue({ id: CATEGORY_ID });
    count.mockResolvedValue(3);

    await expect(service.remove(CATEGORY_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(count).toHaveBeenCalledWith({
      where: { categoryId: CATEGORY_ID, active: true },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('desactiva la categoría cuando no tiene productos activos', async () => {
    const { service, findUnique, count, update } = createMocks();

    findUnique.mockResolvedValue({ id: CATEGORY_ID });
    count.mockResolvedValue(0);
    update.mockResolvedValue(categoryRecord({ active: false }));

    const result = await service.remove(CATEGORY_ID);

    expect(update).toHaveBeenCalledWith({
      where: { id: CATEGORY_ID },
      data: { active: false },
      select: expect.anything(),
    });
    expect(result.active).toBe(false);
  });
});
