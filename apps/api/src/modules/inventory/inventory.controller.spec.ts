import { describe, expect, it, jest } from '@jest/globals';
import { Role, StockMovementType } from '../../generated/prisma/client.js';
import type { PaginationMetaDto } from '../../common/dto/pagination-meta.dto.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.js';
import type { CreateMovementDto } from './dto/create-movement.dto.js';
import type { InventorySummaryDto } from './dto/inventory-summary.dto.js';
import type { PaginatedLowStockDto } from './dto/paginated-low-stock.dto.js';
import type { PaginatedStockMovementsDto } from './dto/paginated-stock-movements.dto.js';
import type { QueryLowStockDto } from './dto/query-low-stock.dto.js';
import type { QueryMovementsDto } from './dto/query-movements.dto.js';
import type { StockMovementResponseDto } from './dto/stock-movement-response.dto.js';
import { InventoryController } from './inventory.controller.js';
import type { InventoryService } from './inventory.service.js';

const PRODUCT_ID = '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f';
const USER_ID = '4f1c9f5e-4c0f-4d4a-9e0b-7a9f5b2d3c11';

const META: PaginationMetaDto = {
  page: 1,
  pageSize: 20,
  total: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

const MOVEMENT: StockMovementResponseDto = {
  id: '9a8b7c6d-5e4f-4a3b-9c2d-1e0f3a4b5c6d',
  productId: PRODUCT_ID,
  product: { id: PRODUCT_ID, sku: 'BEB-001', name: 'Agua Cristal 600 ml' },
  type: StockMovementType.ENTRY,
  quantity: 24,
  previousStock: 10,
  newStock: 34,
  unitCost: 1900,
  reason: 'Compra a proveedor',
  saleId: null,
  user: { id: USER_ID, name: 'Administrador POS', email: 'admin@pos.local' },
  createdAt: '2026-02-12T09:15:00.000Z',
};

const MOVEMENT_PAGE: PaginatedStockMovementsDto = {
  data: [MOVEMENT],
  meta: META,
};

const LOW_STOCK_PAGE: PaginatedLowStockDto = { data: [], meta: META };

const SUMMARY: InventorySummaryDto = {
  totalProducts: 3,
  totalUnits: 50,
  inventoryValue: 30_000,
  lowStockCount: 2,
  outOfStockCount: 1,
  generatedAt: '2026-02-12T09:15:00.000Z',
};

const CURRENT_USER: AuthenticatedUser = {
  id: USER_ID,
  email: 'admin@pos.local',
  role: Role.ADMIN,
};

function createController() {
  const createMovement =
    jest.fn<
      (dto: CreateMovementDto, userId: string) => Promise<StockMovementResponseDto>
    >();
  const listMovements =
    jest.fn<
      (query: QueryMovementsDto) => Promise<PaginatedStockMovementsDto>
    >();
  const lowStock =
    jest.fn<(query: QueryLowStockDto) => Promise<PaginatedLowStockDto>>();
  const summary = jest.fn<() => Promise<InventorySummaryDto>>();

  const inventory = {
    createMovement,
    listMovements,
    lowStock,
    summary,
  } as unknown as InventoryService;

  return {
    controller: new InventoryController(inventory),
    createMovement,
    listMovements,
    lowStock,
    summary,
  };
}

describe('InventoryController', () => {
  it('registra un movimiento con el usuario autenticado', async () => {
    const { controller, createMovement } = createController();
    const dto: CreateMovementDto = {
      productId: PRODUCT_ID,
      type: 'ENTRY',
      quantity: 24,
      unitCost: 1900,
    };
    createMovement.mockResolvedValue(MOVEMENT);

    const result = await controller.createMovement(dto, CURRENT_USER);

    expect(createMovement).toHaveBeenCalledWith(dto, CURRENT_USER.id);
    expect(result).toBe(MOVEMENT);
  });

  it('lista movimientos delegando los filtros', async () => {
    const { controller, listMovements } = createController();
    const query: QueryMovementsDto = { page: 1, pageSize: 20, type: 'ENTRY' };
    listMovements.mockResolvedValue(MOVEMENT_PAGE);

    const result = await controller.listMovements(query);

    expect(listMovements).toHaveBeenCalledWith(query);
    expect(result).toBe(MOVEMENT_PAGE);
  });

  it('lista productos con stock bajo', async () => {
    const { controller, lowStock } = createController();
    const query: QueryLowStockDto = { page: 1, pageSize: 20, search: 'agua' };
    lowStock.mockResolvedValue(LOW_STOCK_PAGE);

    const result = await controller.lowStock(query);

    expect(lowStock).toHaveBeenCalledWith(query);
    expect(result).toBe(LOW_STOCK_PAGE);
  });

  it('devuelve el resumen de inventario', async () => {
    const { controller, summary } = createController();
    summary.mockResolvedValue(SUMMARY);

    const result = await controller.summary();

    expect(summary).toHaveBeenCalledTimes(1);
    expect(result).toBe(SUMMARY);
  });
});
