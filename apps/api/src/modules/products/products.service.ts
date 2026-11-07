import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PriceField,
  type Prisma,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PaginatedPriceHistoryDto } from './dto/paginated-price-history.dto.js';
import type { PaginatedProductsDto } from './dto/paginated-products.dto.js';
import type { CreateProductDto } from './dto/create-product.dto.js';
import type { ProductResponseDto } from './dto/product-response.dto.js';
import type { QueryPriceHistoryDto } from './dto/query-price-history.dto.js';
import type { QueryProductsDto } from './dto/query-products.dto.js';
import type { UpdateProductDto } from './dto/update-product.dto.js';
import {
  PRICE_HISTORY_SELECT,
  PRODUCT_INCLUDE,
  toPriceHistoryResponseDto,
  toProductResponseDto,
} from './products.mapper.js';

const UNIQUE_VIOLATION = 'P2002';
const RECORD_NOT_FOUND = 'P2025';

const PRODUCT_NOT_FOUND = 'Producto no encontrado';
const SKU_TAKEN = 'Ya existe un producto con ese SKU';
const BARCODE_TAKEN = 'Ya existe un producto con ese código de barras';
const CATEGORY_NOT_FOUND = 'La categoría indicada no existe';
const CATEGORY_INACTIVE =
  'La categoría está inactiva: no admite productos nuevos';
const STOCK_MANAGED_ELSEWHERE =
  'El stock no se edita desde el catálogo; se gestiona con movimientos de inventario';

function prismaErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;

  return typeof code === 'string' ? code : undefined;
}

/** Recorta el SKU y lo normaliza en mayúsculas. */
function normalizeSku(sku: string): string {
  return sku.trim().toUpperCase();
}

/** Recorta un texto opcional y convierte el vacío en `null`. */
function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

/** Unidad por defecto cuando no se envía. */
function normalizeUnit(unit: string | undefined): string {
  const trimmed = unit?.trim();

  return trimmed && trimmed.length > 0 ? trimmed : 'unidad';
}

/** Convierte un importe a centavos para comparar sin errores de coma flotante. */
function toCents(value: number): number {
  return Math.round(value * 100);
}

/**
 * El stock solo lo modifican los movimientos de inventario (Fase 4). Si el
 * payload lo incluye, se rechaza aunque el DTO no lo declare.
 */
function assertNoStock(payload: object): void {
  if (Object.prototype.hasOwnProperty.call(payload, 'stock')) {
    throw new BadRequestException(STOCK_MANAGED_ELSEWHERE);
  }
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Listado paginado con búsqueda, filtros, orden y stock bajo. */
  async list(query: QueryProductsDto): Promise<PaginatedProductsDto> {
    const { page, pageSize } = query;
    const where: Prisma.ProductWhereInput = { deletedAt: null };
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

    if (query.active === 'true') {
      where.active = true;
    }

    if (query.active === 'false') {
      where.active = false;
    }

    if (query.lowStock === 'true') {
      where.stock = { lte: this.prisma.product.fields.minStock };
    }

    if (query.lowStock === 'false') {
      where.stock = { gt: this.prisma.product.fields.minStock };
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
      { [query.sort]: query.order } as Prisma.ProductOrderByWithRelationInput,
      { id: 'asc' },
    ];

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    return {
      data: products.map((product) => toProductResponseDto(product)),
      meta: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: total > 0 && page > 1,
      },
    };
  }

  /** Detalle de un producto no eliminado, con su categoría. */
  async findOne(id: string): Promise<ProductResponseDto> {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: PRODUCT_INCLUDE,
    });

    if (!product) {
      throw new NotFoundException(PRODUCT_NOT_FOUND);
    }

    return toProductResponseDto(product);
  }

  /**
   * Crea un producto con stock inicial `0` y registra los precios iniciales
   * (`COST` y `SALE`, valor anterior `0`) en el historial.
   */
  async create(
    dto: CreateProductDto,
    changedById: string,
  ): Promise<ProductResponseDto> {
    assertNoStock(dto);

    const sku = normalizeSku(dto.sku);
    const barcode = normalizeOptionalText(dto.barcode);

    await this.requireActiveCategory(dto.categoryId);
    await this.assertSkuAvailable(sku);

    if (barcode) {
      await this.assertBarcodeAvailable(barcode);
    }

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            sku,
            barcode,
            name: dto.name.trim(),
            description: normalizeOptionalText(dto.description),
            categoryId: dto.categoryId,
            costPrice: dto.costPrice,
            salePrice: dto.salePrice,
            stock: 0,
            minStock: dto.minStock ?? 0,
            unit: normalizeUnit(dto.unit),
            imageUrl: dto.imageUrl ?? null,
            active: dto.active ?? true,
          },
          include: PRODUCT_INCLUDE,
        });

        await tx.priceHistory.createMany({
          data: [
            {
              productId: created.id,
              field: PriceField.COST,
              oldValue: 0,
              newValue: dto.costPrice,
              changedById,
            },
            {
              productId: created.id,
              field: PriceField.SALE,
              oldValue: 0,
              newValue: dto.salePrice,
              changedById,
            },
          ],
        });

        return created;
      });

      return toProductResponseDto(product);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  /**
   * Actualiza catálogo y estado. Si cambia `costPrice` o `salePrice`, inserta
   * el cambio en `PriceHistory` dentro de la misma transacción.
   */
  async update(
    id: string,
    dto: UpdateProductDto,
    changedById: string,
  ): Promise<ProductResponseDto> {
    assertNoStock(dto);

    if (!this.hasUpdatableField(dto)) {
      throw new BadRequestException('No hay campos para actualizar');
    }

    const existing = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        sku: true,
        barcode: true,
        costPrice: true,
        salePrice: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(PRODUCT_NOT_FOUND);
    }

    const data: Prisma.ProductUncheckedUpdateInput = {};

    if (dto.sku !== undefined) {
      const sku = normalizeSku(dto.sku);

      if (sku !== existing.sku) {
        await this.assertSkuAvailable(sku, id);
      }

      data.sku = sku;
    }

    if (dto.barcode !== undefined) {
      const barcode = normalizeOptionalText(dto.barcode);

      if (barcode !== existing.barcode && barcode !== null) {
        await this.assertBarcodeAvailable(barcode, id);
      }

      data.barcode = barcode;
    }

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (dto.description !== undefined) {
      data.description = normalizeOptionalText(dto.description);
    }

    if (dto.categoryId !== undefined) {
      await this.requireActiveCategory(dto.categoryId);
      data.categoryId = dto.categoryId;
    }

    const currentCost = existing.costPrice.toNumber();
    const currentSale = existing.salePrice.toNumber();
    const costChanged =
      dto.costPrice !== undefined &&
      toCents(dto.costPrice) !== toCents(currentCost);
    const saleChanged =
      dto.salePrice !== undefined &&
      toCents(dto.salePrice) !== toCents(currentSale);

    if (dto.costPrice !== undefined) {
      data.costPrice = dto.costPrice;
    }

    if (dto.salePrice !== undefined) {
      data.salePrice = dto.salePrice;
    }

    if (dto.minStock !== undefined) {
      data.minStock = dto.minStock;
    }

    if (dto.unit !== undefined) {
      data.unit = normalizeUnit(dto.unit);
    }

    if (dto.imageUrl !== undefined) {
      data.imageUrl = normalizeOptionalText(dto.imageUrl);
    }

    if (dto.active !== undefined) {
      data.active = dto.active;
    }

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.product.update({
          where: { id },
          data,
          include: PRODUCT_INCLUDE,
        });

        const history: Prisma.PriceHistoryCreateManyInput[] = [];

        if (costChanged) {
          history.push({
            productId: id,
            field: PriceField.COST,
            oldValue: currentCost,
            newValue: dto.costPrice ?? currentCost,
            changedById,
          });
        }

        if (saleChanged) {
          history.push({
            productId: id,
            field: PriceField.SALE,
            oldValue: currentSale,
            newValue: dto.salePrice ?? currentSale,
            changedById,
          });
        }

        if (history.length > 0) {
          await tx.priceHistory.createMany({ data: history });
        }

        return updated;
      });

      return toProductResponseDto(product);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  /** Borrado lógico (`active: false`, `deletedAt: now()`); idempotente. */
  async remove(id: string): Promise<void> {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });

    if (!existing) {
      throw new NotFoundException(PRODUCT_NOT_FOUND);
    }

    if (existing.deletedAt !== null) {
      return;
    }

    try {
      await this.prisma.product.update({
        where: { id },
        data: { active: false, deletedAt: new Date() },
      });
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  /** Historial de precios paginado, más reciente primero. */
  async priceHistory(
    id: string,
    query: QueryPriceHistoryDto,
  ): Promise<PaginatedPriceHistoryDto> {
    const { page, pageSize } = query;

    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException(PRODUCT_NOT_FOUND);
    }

    const where: Prisma.PriceHistoryWhereInput = { productId: id };
    const [total, entries] = await this.prisma.$transaction([
      this.prisma.priceHistory.count({ where }),
      this.prisma.priceHistory.findMany({
        where,
        select: PRICE_HISTORY_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    return {
      data: entries.map((entry) =>
        toPriceHistoryResponseDto(entry),
      ),
      meta: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: total > 0 && page > 1,
      },
    };
  }

  private hasUpdatableField(dto: UpdateProductDto): boolean {
    return [
      dto.sku,
      dto.barcode,
      dto.name,
      dto.description,
      dto.categoryId,
      dto.costPrice,
      dto.salePrice,
      dto.minStock,
      dto.unit,
      dto.imageUrl,
      dto.active,
    ].some((value) => value !== undefined);
  }

  /** Verifica que la categoría exista y esté activa. */
  private async requireActiveCategory(
    categoryId: string,
  ): Promise<{ id: string }> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, active: true },
    });

    if (!category) {
      throw new BadRequestException(CATEGORY_NOT_FOUND);
    }

    if (!category.active) {
      throw new BadRequestException(CATEGORY_INACTIVE);
    }

    return { id: category.id };
  }

  private async assertSkuAvailable(
    sku: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.product.findFirst({
      where: { sku: { equals: sku, mode: 'insensitive' } },
      select: { id: true },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(SKU_TAKEN);
    }
  }

  private async assertBarcodeAvailable(
    barcode: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.product.findFirst({
      where: { barcode },
      select: { id: true },
    });

    if (existing && existing.id !== excludeId) {
      throw new ConflictException(BARCODE_TAKEN);
    }
  }

  /** Traduce errores de Prisma a excepciones HTTP. */
  private toHttpError(error: unknown): Error {
    const code = prismaErrorCode(error);

    if (code === RECORD_NOT_FOUND) {
      return new NotFoundException(PRODUCT_NOT_FOUND);
    }

    if (code === UNIQUE_VIOLATION) {
      return new ConflictException(SKU_TAKEN);
    }

    return error instanceof Error
      ? error
      : new Error('Error inesperado al guardar el producto');
  }
}
