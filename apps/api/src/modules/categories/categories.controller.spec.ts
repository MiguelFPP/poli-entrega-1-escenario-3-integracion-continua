import { describe, expect, it, jest } from '@jest/globals';
import type { CategoriesService } from './categories.service.js';
import { CategoriesController } from './categories.controller.js';
import type { CategoryResponseDto } from './dto/category-response.dto.js';
import type { CreateCategoryDto } from './dto/create-category.dto.js';
import type { QueryCategoriesDto } from './dto/query-categories.dto.js';
import type { UpdateCategoryDto } from './dto/update-category.dto.js';

const CATEGORY_ID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';

const CATEGORY: CategoryResponseDto = {
  id: CATEGORY_ID,
  name: 'Bebidas',
  description: 'Bebidas frías y calientes',
  active: true,
  productCount: 3,
  createdAt: '2026-02-10T14:30:00.000Z',
  updatedAt: '2026-02-12T09:15:00.000Z',
};

function createController() {
  const list =
    jest.fn<(query: QueryCategoriesDto) => Promise<CategoryResponseDto[]>>();
  const create =
    jest.fn<(dto: CreateCategoryDto) => Promise<CategoryResponseDto>>();
  const update =
    jest.fn<
      (id: string, dto: UpdateCategoryDto) => Promise<CategoryResponseDto>
    >();
  const remove = jest.fn<(id: string) => Promise<CategoryResponseDto>>();

  const categories = { list, create, update, remove } as unknown as CategoriesService;

  return {
    controller: new CategoriesController(categories),
    list,
    create,
    update,
    remove,
  };
}

describe('CategoriesController', () => {
  it('lista categorías delegando los filtros', async () => {
    const { controller, list } = createController();
    const query: QueryCategoriesDto = { search: 'beb', active: 'true' };
    list.mockResolvedValue([CATEGORY]);

    const result = await controller.list(query);

    expect(list).toHaveBeenCalledWith(query);
    expect(result).toEqual([CATEGORY]);
  });

  it('crea una categoría', async () => {
    const { controller, create } = createController();
    const dto: CreateCategoryDto = { name: 'Bebidas' };
    create.mockResolvedValue(CATEGORY);

    const result = await controller.create(dto);

    expect(create).toHaveBeenCalledWith(dto);
    expect(result).toBe(CATEGORY);
  });

  it('actualiza una categoría por id', async () => {
    const { controller, update } = createController();
    const dto: UpdateCategoryDto = { description: null, active: false };
    update.mockResolvedValue({ ...CATEGORY, active: false, description: null });

    const result = await controller.update(CATEGORY_ID, dto);

    expect(update).toHaveBeenCalledWith(CATEGORY_ID, dto);
    expect(result.active).toBe(false);
  });

  it('desactiva una categoría (borrado lógico)', async () => {
    const { controller, remove } = createController();
    remove.mockResolvedValue({ ...CATEGORY, active: false });

    const result = await controller.remove(CATEGORY_ID);

    expect(remove).toHaveBeenCalledWith(CATEGORY_ID);
    expect(result.active).toBe(false);
  });
});
