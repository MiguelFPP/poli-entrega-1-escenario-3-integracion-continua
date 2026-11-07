import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PriceField, type Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateMovementDto } from './dto/create-movement.dto.js';
import type { InventorySummaryDto } from './dto/inventory-summary.dto.js';
import type { PaginatedLowStockDto } from './dto/paginated-low-stock.dto.js';
import type { PaginatedStockMovementsDto } from './dto/paginated-stock-movements.dto.js';
import type { QueryLowStockDto } from './dto/query-low-stock.dto.js';
import type { QueryMovementsDto } from './dto/query-movements.dto.js';
import type { QueryProductMovementsDto } from './dto/query-product-movements.dto.js';
import type { StockMovementResponseDto } from './dto/stock-movement-response.dto.js';
import {
  LOW_STOCK_SELECT,
  MOVEMENT_TYPE_VALUES,
  STOCK_MOVEMENT_INCLUDE,
  buildPaginationMeta,
  round2,
  toCents,
  toLowStockItemDto,
  toStockMovementResponseDto,
} from './inventory.mapper.js';

const RECORD_NOT_FOUND = 'P2025';

const PRODUCT_NOT_FOUND = 'Producto no encontrado';
const QUANTITY_NOT_ZERO = 'La cantidad debe ser distinta de 0';
const ENTRY_QUANTITY_POSITIVE =
  'La cantidad de una entrada debe ser mayor que cero';
const ADJUSTMENT_REASON_REQUIRED =
  'El motivo es obligatorio para los ajustes de inventario';

/** Mínimo de columnas necesarias para recalcular el inventario del producto. */
const LOCKED_PRODUCT_SELECT = {
  id: true,
  sku: true,
  name: true,
  stock: true,
  costPrice: true,
  deletedAt: true,
} as const satisfies Prisma.ProductSelect;

function prismaErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;

  return typeof code === 'string' ? code : undefined;
}

/** Recorta el motivo y convierte el vacío en `null`. */
function normalizeReason(reason: string | undefined): string | null {
  const trimmed = reason?.trim();

  return trimmed && trimmed.length > 0 ? trimmed : null;
}

/** Convierte un texto ISO 8601 a `Date`, rechazando valores inválidos. */
function parseIsoDate(
  value: string | undefined,
  field: string,
): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(
      `${field} debe ser una fecha ISO 8601 válida`,
    );
  }

  return date;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Registra una entrada o un ajuste y recalcula stock y costo promedio. */
  async createMovement(
    dto: CreateMovementDto,
    userId: string,
  ): Promise<StockMovementResponseDto> {
    const quantity = dto.quantity;
    const reason = normalizeReason(dto.reason);
    const isEntry = dto.type === 'ENTRY';

    if (quantity === 0) {
      throw new BadRequestException(QUANTITY_NOT_ZERO);
    }

    if (isEntry && quantity < 0) {
      throw new BadRequestException(ENTRY_QUANTITY_POSITIVE);
    }

    if (!isEntry && reason === null) {
      throw new BadRequestException(ADJUSTMENT_REASON_REQUIRED);
    }

    try {
      const movement = await this.prisma.$transaction(async (tx) => {
        // Bloquea la fila para serializar entradas y ajustes concurrentes.
        await tx.$queryRaw`SELECT id FROM "products" WHERE id = ${dto.productId} FOR UPDATE`;

        const product = await tx.product.findUnique({
          where: { id: dto.productId },
          select: LOCKED_PRODUCT_SELECT,
        });

        if (!product || product.deletedAt !== null) {
          throw new NotFoundException(PRODUCT_NOT_FOUND);
        }

        const previousStock = product.stock;
        const newStock = previousStock + quantity;

        if (newStock < 0) {
          throw new ConflictException(
            `Stock insuficiente: ${product.sku} tiene ${previousStock} unidades y el ajuste descuenta ${Math.abs(quantity)}`,
          );
        }

        const currentCost = product.costPrice.toNumber();
        // En ADJUSTMENT se ignora el costo recibido y se guarda el vigente.
        const unitCost = isEntry ? (dto.unitCost ?? currentCost) : currentCost;
        const newCost = isEntry
          ? round2(
              (previousStock * currentCost + quantity * unitCost) / newStock,
            )
          : currentCost;

        const data: Prisma.ProductUncheckedUpdateInput = isEntry
          ? { stock: newStock, costPrice: newCost }
          : { stock: newStock };

        await tx.product.update({ where: { id: product.id }, data });

        if (isEntry && toCents(newCost) !== toCents(currentCost)) {
          await tx.priceHistory.create({
            data: {
              productId: product.id,
              field: PriceField.COST,
              oldValue: currentCost,
              newValue: newCost,
              changedById: userId,
            },
          });
        }

        return await tx.stockMovement.create({
          data: {
            productId: product.id,
            type: MOVEMENT_TYPE_VALUES[dto.type],
            quantity,
            previousStock,
            newStock,
            unitCost: round2(unitCost),
            reason,
            userId,
          },
          include: STOCK_MOVEMENT_INCLUDE,
        });
      });

      return toStockMovementResponseDto(movement);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  /** Movimientos paginados y filtrados, más recientes primero. */
  async listMovements(
    query: QueryMovementsDto,
  ): Promise<PaginatedStockMovementsDto> {
    const where: Prisma.StockMovementWhereInput = {};

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.type) {
      where.type = MOVEMENT_TYPE_VALUES[query.type];
    }

    const from = parseIsoDate(query.from, 'from');
    const to = parseIsoDate(query.to, 'to');

    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    return this.paginateMovements(query, where);
  }

  /** Historial de stock de un producto activo (no eliminado). */
  async productMovements(
    productId: string,
    query: QueryProductMovementsDto,
  ): Promise<PaginatedStockMovementsDto> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException(PRODUCT_NOT_FOUND);
    }

    const where: Prisma.StockMovementWhereInput = { productId };

    if (query.type) {
      where.type = MOVEMENT_TYPE_VALUES[query.type];
    }

    return this.paginateMovements(query, where);
  }

  /** Productos activos con `stock <= minStock`, del más crítico al menos. */
  async lowStock(query: QueryLowStockDto): Promise<PaginatedLowStockDto> {
    const { page, pageSize } = query;
    const where: Prisma.ProductWhereInput = {
      active: true,
      deletedAt: null,
      stock: { lte: this.prisma.product.fields.minStock },
    };
    const search = query.search?.trim();

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        select: LOW_STOCK_SELECT,
        orderBy: [{ stock: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data: products.map((product) => toLowStockItemDto(product)),
      meta: buildPaginationMeta(page, pageSize, total),
    };
  }

  /** Valorización e indicadores de reposición de los productos activos. */
  async summary(): Promise<InventorySummaryDto> {
    const products = await this.prisma.product.findMany({
      where: { active: true, deletedAt: null },
      select: { stock: true, minStock: true, costPrice: true },
    });

    let totalUnits = 0;
    let inventoryValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const product of products) {
      totalUnits += product.stock;
      inventoryValue += product.stock * product.costPrice.toNumber();

      if (product.stock === 0) {
        outOfStockCount += 1;
      }

      if (product.stock <= product.minStock) {
        lowStockCount += 1;
      }
    }

    return {
      totalProducts: products.length,
      totalUnits,
      inventoryValue: round2(inventoryValue),
      lowStockCount,
      outOfStockCount,
      generatedAt: new Date().toISOString(),
    };
  }

  private async paginateMovements(
    query: QueryProductMovementsDto,
    where: Prisma.StockMovementWhereInput,
  ): Promise<PaginatedStockMovementsDto> {
    const { page, pageSize } = query;
    const [total, movements] = await this.prisma.$transaction([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        include: STOCK_MOVEMENT_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data: movements.map((movement) => toStockMovementResponseDto(movement)),
      meta: buildPaginationMeta(page, pageSize, total),
    };
  }

  /** Deja pasar los errores HTTP propios y traduce los de Prisma. */
  private toHttpError(error: unknown): Error {
    if (error instanceof HttpException) {
      return error;
    }

    if (prismaErrorCode(error) === RECORD_NOT_FOUND) {
      return new NotFoundException(PRODUCT_NOT_FOUND);
    }

    return error instanceof Error
      ? error
      : new Error('Error inesperado al registrar el movimiento');
  }
}
