import { describe, expect, it, jest } from '@jest/globals';
import { StockMovementType } from '../../generated/prisma/client.js';
import type { PaginatedStockMovementsDto } from './dto/paginated-stock-movements.dto.js';
import type { QueryProductMovementsDto } from './dto/query-product-movements.dto.js';
import { ProductStockController } from './product-stock.controller.js';
import type { InventoryService } from './inventory.service.js';

const PRODUCT_ID = '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f';

const PAGE: PaginatedStockMovementsDto = {
  data: [
    {
      id: '9a8b7c6d-5e4f-4a3b-9c2d-1e0f3a4b5c6d',
      productId: PRODUCT_ID,
      product: { id: PRODUCT_ID, sku: 'BEB-001', name: 'Agua Cristal 600 ml' },
      type: StockMovementType.SALE,
      quantity: -2,
      previousStock: 12,
      newStock: 10,
      unitCost: 1200,
      reason: null,
      saleId: '3c4d5e6f-7a8b-4c9d-9e0f-1a2b3c4d5e6f',
      user: { id: '4f1c9f5e-4c0f-4d4a-9e0b-7a9f5b2d3c11', name: 'Admin', email: 'admin@pos.local' },
      createdAt: '2026-02-12T09:15:00.000Z',
    },
  ],
  meta: {
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

function createController() {
  const productMovements =
    jest.fn<
      (
        id: string,
        query: QueryProductMovementsDto,
      ) => Promise<PaginatedStockMovementsDto>
    >();

  const inventory = { productMovements } as unknown as InventoryService;

  return {
    controller: new ProductStockController(inventory),
    productMovements,
  };
}

describe('ProductStockController', () => {
  it('delega el historial de stock del producto con su paginación', async () => {
    const { controller, productMovements } = createController();
    const query: QueryProductMovementsDto = {
      page: 1,
      pageSize: 20,
      type: 'SALE',
    };
    productMovements.mockResolvedValue(PAGE);

    const result = await controller.listMovements(PRODUCT_ID, query);

    expect(productMovements).toHaveBeenCalledWith(PRODUCT_ID, query);
    expect(result).toBe(PAGE);
  });
});
