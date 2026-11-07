import { describe, expect, it, jest } from '@jest/globals';
import { Role } from '../../generated/prisma/client.js';
import type { PaginationMetaDto } from '../../common/dto/pagination-meta.dto.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.js';
import type { CreateSaleDto } from './dto/create-sale.dto.js';
import type { PaginatedSalesDto } from './dto/paginated-sales.dto.js';
import type { QuerySalesDto } from './dto/query-sales.dto.js';
import type { SaleDetailDto } from './dto/sale-response.dto.js';
import type { VoidSaleDto } from './dto/void-sale.dto.js';
import { SalesController } from './sales.controller.js';
import type { SalesService } from './sales.service.js';

const SALE_ID = '3c4d5e6f-7a8b-4c9d-9e0f-1a2b3c4d5e6f';
const PRODUCT_ID = '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f';
const USER_ID = '4f1c9f5e-4c0f-4d4a-9e0b-7a9f5b2d3c11';

const META: PaginationMetaDto = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

const PAGE: PaginatedSalesDto = { data: [], meta: META };

const DETAIL = { id: SALE_ID, number: 'V-000001' } as unknown as SaleDetailDto;

const CURRENT_USER: AuthenticatedUser = {
  id: USER_ID,
  email: 'admin@pos.local',
  role: Role.ADMIN,
};

function createController() {
  const create =
    jest.fn<(dto: CreateSaleDto, userId: string) => Promise<SaleDetailDto>>();
  const list = jest.fn<(query: QuerySalesDto) => Promise<PaginatedSalesDto>>();
  const findOne = jest.fn<(id: string) => Promise<SaleDetailDto>>();
  const receipt = jest.fn<(id: string) => Promise<SaleDetailDto>>();
  const voidSale =
    jest.fn<
      (id: string, dto: VoidSaleDto, userId: string) => Promise<SaleDetailDto>
    >();

  const sales = {
    create,
    list,
    findOne,
    receipt,
    voidSale,
  } as unknown as SalesService;

  return {
    controller: new SalesController(sales),
    create,
    list,
    findOne,
    receipt,
    voidSale,
  };
}

describe('SalesController', () => {
  it('registra la venta con el usuario autenticado', async () => {
    const { controller, create } = createController();
    const dto: CreateSaleDto = {
      items: [{ productId: PRODUCT_ID, quantity: 2 }],
      payment: { method: 'CASH', cashReceived: 40_000 },
    };
    create.mockResolvedValue(DETAIL);

    const result = await controller.create(dto, CURRENT_USER);

    expect(create).toHaveBeenCalledWith(dto, CURRENT_USER.id);
    expect(result).toBe(DETAIL);
  });

  it('lista las ventas delegando los filtros', async () => {
    const { controller, list } = createController();
    const query: QuerySalesDto = {
      page: 1,
      pageSize: 20,
      status: 'COMPLETED',
    };
    list.mockResolvedValue(PAGE);

    const result = await controller.list(query);

    expect(list).toHaveBeenCalledWith(query);
    expect(result).toBe(PAGE);
  });

  it('devuelve el detalle de una venta', async () => {
    const { controller, findOne } = createController();
    findOne.mockResolvedValue(DETAIL);

    const result = await controller.findOne(SALE_ID);

    expect(findOne).toHaveBeenCalledWith(SALE_ID);
    expect(result).toBe(DETAIL);
  });

  it('devuelve el comprobante de la venta', async () => {
    const { controller, receipt } = createController();
    receipt.mockResolvedValue(DETAIL);

    const result = await controller.receipt(SALE_ID);

    expect(receipt).toHaveBeenCalledWith(SALE_ID);
    expect(result).toBe(DETAIL);
  });

  it('anula la venta con el motivo y el usuario autenticado', async () => {
    const { controller, voidSale } = createController();
    const dto: VoidSaleDto = { reason: 'Error de digitación' };
    voidSale.mockResolvedValue(DETAIL);

    const result = await controller.voidSale(SALE_ID, dto, CURRENT_USER);

    expect(voidSale).toHaveBeenCalledWith(SALE_ID, dto, CURRENT_USER.id);
    expect(result).toBe(DETAIL);
  });
});
