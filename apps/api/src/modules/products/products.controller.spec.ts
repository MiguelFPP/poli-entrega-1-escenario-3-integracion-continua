import { describe, expect, it, jest } from '@jest/globals';
import { Role } from '../../generated/prisma/client.js';
import type { PaginationMetaDto } from '../../common/dto/pagination-meta.dto.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.js';
import type { CreateProductDto } from './dto/create-product.dto.js';
import type { PaginatedPriceHistoryDto } from './dto/paginated-price-history.dto.js';
import type { PaginatedProductsDto } from './dto/paginated-products.dto.js';
import type { ProductResponseDto } from './dto/product-response.dto.js';
import type { QueryPriceHistoryDto } from './dto/query-price-history.dto.js';
import type { QueryProductsDto } from './dto/query-products.dto.js';
import type { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductsController } from './products.controller.js';
import type { ProductsService } from './products.service.js';

const PRODUCT_ID = '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f';
const CATEGORY_ID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';

const META: PaginationMetaDto = {
  page: 1,
  pageSize: 20,
  total: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

const PRODUCT: ProductResponseDto = {
  id: PRODUCT_ID,
  sku: 'BEB-001',
  barcode: '7701000000011',
  name: 'Agua Cristal 600 ml',
  description: 'Agua purificada sin gas',
  categoryId: CATEGORY_ID,
  category: { id: CATEGORY_ID, name: 'Bebidas' },
  costPrice: 1200,
  salePrice: 2000,
  stock: 96,
  minStock: 24,
  unit: 'botella',
  imageUrl: null,
  active: true,
  lowStock: false,
  createdAt: '2026-02-10T14:30:00.000Z',
  updatedAt: '2026-02-12T09:15:00.000Z',
};

const PAGE: PaginatedProductsDto = { data: [PRODUCT], meta: META };

const HISTORY: PaginatedPriceHistoryDto = { data: [], meta: META };

const CURRENT_USER: AuthenticatedUser = {
  id: '4f1c9f5e-4c0f-4d4a-9e0b-7a9f5b2d3c11',
  email: 'admin@pos.local',
  role: Role.ADMIN,
};

function createController() {
  const list =
    jest.fn<(query: QueryProductsDto) => Promise<PaginatedProductsDto>>();
  const create =
    jest.fn<
      (dto: CreateProductDto, userId: string) => Promise<ProductResponseDto>
    >();
  const findOne = jest.fn<(id: string) => Promise<ProductResponseDto>>();
  const update =
    jest.fn<
      (
        id: string,
        dto: UpdateProductDto,
        userId: string,
      ) => Promise<ProductResponseDto>
    >();
  const remove = jest.fn<(id: string) => Promise<void>>();
  const priceHistory =
    jest.fn<
      (id: string, query: QueryPriceHistoryDto) => Promise<PaginatedPriceHistoryDto>
    >();

  const products = {
    list,
    create,
    findOne,
    update,
    remove,
    priceHistory,
  } as unknown as ProductsService;

  return {
    controller: new ProductsController(products),
    list,
    create,
    findOne,
    update,
    remove,
    priceHistory,
  };
}

describe('ProductsController', () => {
  it('lista productos delegando los filtros', async () => {
    const { controller, list } = createController();
    const query: QueryProductsDto = {
      page: 1,
      pageSize: 20,
      sort: 'name',
      order: 'asc',
    };
    list.mockResolvedValue(PAGE);

    const result = await controller.list(query);

    expect(list).toHaveBeenCalledWith(query);
    expect(result).toBe(PAGE);
  });

  it('crea un producto con el usuario autenticado', async () => {
    const { controller, create } = createController();
    const dto: CreateProductDto = {
      sku: 'BEB-001',
      name: 'Agua Cristal 600 ml',
      categoryId: CATEGORY_ID,
      costPrice: 1200,
      salePrice: 2000,
      minStock: 0,
      unit: 'unidad',
    };
    create.mockResolvedValue(PRODUCT);

    const result = await controller.create(dto, CURRENT_USER);

    expect(create).toHaveBeenCalledWith(dto, CURRENT_USER.id);
    expect(result).toBe(PRODUCT);
  });

  it('devuelve el detalle de un producto', async () => {
    const { controller, findOne } = createController();
    findOne.mockResolvedValue(PRODUCT);

    const result = await controller.findOne(PRODUCT_ID);

    expect(findOne).toHaveBeenCalledWith(PRODUCT_ID);
    expect(result.id).toBe(PRODUCT_ID);
  });

  it('actualiza un producto con el usuario autenticado', async () => {
    const { controller, update } = createController();
    const dto: UpdateProductDto = { salePrice: 2200 };
    update.mockResolvedValue(PRODUCT);

    const result = await controller.update(PRODUCT_ID, dto, CURRENT_USER);

    expect(update).toHaveBeenCalledWith(PRODUCT_ID, dto, CURRENT_USER.id);
    expect(result).toBe(PRODUCT);
  });

  it('elimina un producto sin devolver contenido', async () => {
    const { controller, remove } = createController();
    remove.mockResolvedValue(undefined);

    await expect(controller.remove(PRODUCT_ID)).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith(PRODUCT_ID);
  });

  it('devuelve el historial de precios paginado', async () => {
    const { controller, priceHistory } = createController();
    const query: QueryPriceHistoryDto = { page: 1, pageSize: 20 };
    priceHistory.mockResolvedValue(HISTORY);

    const result = await controller.priceHistory(PRODUCT_ID, query);

    expect(priceHistory).toHaveBeenCalledWith(PRODUCT_ID, query);
    expect(result).toBe(HISTORY);
  });
});
