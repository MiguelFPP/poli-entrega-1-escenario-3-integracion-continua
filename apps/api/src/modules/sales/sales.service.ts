import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentMethod,
  SaleStatus,
  StockMovementType,
  type Prisma,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateSaleDto, PaymentInputDto } from './dto/create-sale.dto.js';
import type { PaginatedSalesDto } from './dto/paginated-sales.dto.js';
import type { QuerySalesDto } from './dto/query-sales.dto.js';
import type { SaleDetailDto } from './dto/sale-response.dto.js';
import type { VoidSaleDto } from './dto/void-sale.dto.js';
import {
  computeSaleTotals,
  fromCents,
  toCents,
  type SaleLineCents,
} from './sales.calculator.js';
import {
  PAYMENT_METHOD_VALUES,
  SALE_DETAIL_INCLUDE,
  SALE_ITEM_SELECT,
  SALE_STATUS_VALUES,
  SALE_SUMMARY_INCLUDE,
  toSaleDetailDto,
  toSaleSummaryDto,
} from './sales.mapper.js';

const RECORD_NOT_FOUND = 'P2025';

const SALE_NOT_FOUND = 'Venta no encontrada';
const SALE_ALREADY_VOIDED = 'La venta ya está anulada';
const PRODUCT_NOT_FOUND = 'Producto no encontrado';
const CASH_REQUIRED = 'El pago en efectivo requiere cashReceived';
const CASH_INSUFFICIENT =
  'El efectivo recibido no alcanza para cubrir el total de la venta';
const CARD_WITH_CASH = 'Un pago con tarjeta no admite cashReceived';

/** Datos del producto bloqueado: precio, costo y stock vigentes. */
const LOCKED_PRODUCT_SELECT = {
  id: true,
  sku: true,
  name: true,
  stock: true,
  costPrice: true,
  salePrice: true,
  active: true,
  deletedAt: true,
} as const satisfies Prisma.ProductSelect;

/** Línea ya validada y con el snapshot del producto resuelto. */
type PreparedLine = {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  previousStock: number;
  unitPriceCents: number;
  unitCostCents: number;
};

function prismaErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;

  return typeof code === 'string' ? code : undefined;
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
    throw new BadRequestException(`${field} debe ser una fecha ISO 8601 válida`);
  }

  return date;
}

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Registra la venta completa en una transacción: líneas, pago y stock. */
  async create(dto: CreateSaleDto, userId: string): Promise<SaleDetailDto> {
    const payment = dto.payment;
    const method = PAYMENT_METHOD_VALUES[payment.method];

    if (method === PaymentMethod.CARD && payment.cashReceived !== undefined) {
      throw new BadRequestException(CARD_WITH_CASH);
    }

    const productIds = dto.items.map((item) => item.productId);
    // Bloqueo en orden ascendente de id: evita interbloqueos entre ventas.
    const lockOrder = [...new Set(productIds)].sort();

    try {
      return await this.prisma.$transaction(async (tx) => {
        for (const productId of lockOrder) {
          await tx.$queryRaw`SELECT id FROM "products" WHERE id = ${productId} FOR UPDATE`;
        }

        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          select: LOCKED_PRODUCT_SELECT,
        });
        const productsById = new Map(
          products.map((product) => [product.id, product]),
        );
        const prepared: PreparedLine[] = dto.items.map((item) => {
          const product = productsById.get(item.productId);

          if (!product) {
            throw new NotFoundException(PRODUCT_NOT_FOUND);
          }

          if (!product.active || product.deletedAt !== null) {
            throw new BadRequestException(
              `El producto ${product.sku} no está disponible para la venta`,
            );
          }

          if (product.stock < item.quantity) {
            throw new ConflictException(
              `Stock insuficiente para ${product.sku}: disponible ${product.stock}, solicitado ${item.quantity}`,
            );
          }

          return {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            quantity: item.quantity,
            previousStock: product.stock,
            unitPriceCents: toCents(product.salePrice.toNumber()),
            unitCostCents: toCents(product.costPrice.toNumber()),
          };
        });

        const lines: SaleLineCents[] = prepared.map((line) => ({
          unitPriceCents: line.unitPriceCents,
          unitCostCents: line.unitCostCents,
          quantity: line.quantity,
        }));
        const totals = computeSaleTotals(
          lines,
          dto.discountAmount === undefined ? 0 : toCents(dto.discountAmount),
        );
        const cashReceivedCents = this.resolveCashReceived(
          payment,
          totals.total,
        );
        const changeCents =
          cashReceivedCents === null ? null : cashReceivedCents - totals.total;
        const number = await this.nextSaleNumber(tx);

        const sale = await tx.sale.create({
          data: {
            number,
            status: SaleStatus.COMPLETED,
            userId,
            subtotal: fromCents(totals.subtotal),
            discountAmount: fromCents(totals.discountAmount),
            taxAmount: fromCents(totals.taxAmount),
            total: fromCents(totals.total),
            costTotal: fromCents(totals.costTotal),
            profit: fromCents(totals.profit),
            items: {
              create: prepared.map((line, index) => {
                const lineTotals = totals.lines[index];

                return {
                  productId: line.productId,
                  productName: line.productName,
                  sku: line.sku,
                  quantity: line.quantity,
                  unitPrice: fromCents(line.unitPriceCents),
                  unitCost: fromCents(line.unitCostCents),
                  lineSubtotal: fromCents(lineTotals.lineSubtotal),
                  lineDiscount: fromCents(lineTotals.lineDiscount),
                  lineTax: fromCents(lineTotals.lineTax),
                  lineTotal: fromCents(lineTotals.lineTotal),
                  lineProfit: fromCents(lineTotals.lineProfit),
                };
              }),
            },
          },
          select: { id: true },
        });

        await tx.payment.create({
          data: {
            saleId: sale.id,
            method,
            amount: fromCents(totals.total),
            cashReceived:
              cashReceivedCents === null ? null : fromCents(cashReceivedCents),
            changeGiven: changeCents === null ? null : fromCents(changeCents),
          },
        });

        for (const line of prepared) {
          const decremented = await tx.product.updateMany({
            where: { id: line.productId, stock: { gte: line.quantity } },
            data: { stock: { decrement: line.quantity } },
          });

          if (decremented.count !== 1) {
            throw new ConflictException(
              `Stock insuficiente para ${line.sku}: disponible ${line.previousStock}, solicitado ${line.quantity}`,
            );
          }

          await tx.stockMovement.create({
            data: {
              productId: line.productId,
              type: StockMovementType.SALE,
              quantity: -line.quantity,
              previousStock: line.previousStock,
              newStock: line.previousStock - line.quantity,
              unitCost: fromCents(line.unitCostCents),
              saleId: sale.id,
              userId,
            },
          });
        }

        const detail = await tx.sale.findUnique({
          where: { id: sale.id },
          include: SALE_DETAIL_INCLUDE,
        });

        if (!detail) {
          throw new NotFoundException(SALE_NOT_FOUND);
        }

        return toSaleDetailDto(detail);
      });
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  /** Listado paginado de ventas con filtros de estado y fecha. */
  async list(query: QuerySalesDto): Promise<PaginatedSalesDto> {
    const { page, pageSize } = query;
    const where: Prisma.SaleWhereInput = {};

    if (query.status) {
      where.status = SALE_STATUS_VALUES[query.status];
    }

    const from = parseIsoDate(query.from, 'from');
    const to = parseIsoDate(query.to, 'to');

    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    const [total, sales] = await this.prisma.$transaction([
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({
        where,
        include: SALE_SUMMARY_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    return {
      data: sales.map((sale) => toSaleSummaryDto(sale)),
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

  /** Detalle de una venta con líneas, pago, usuario y anulación. */
  async findOne(id: string): Promise<SaleDetailDto> {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: SALE_DETAIL_INCLUDE,
    });

    if (!sale) {
      throw new NotFoundException(SALE_NOT_FOUND);
    }

    return toSaleDetailDto(sale);
  }

  /** Comprobante imprimible: el detalle de la venta, sin cambios. */
  async receipt(id: string): Promise<SaleDetailDto> {
    return this.findOne(id);
  }

  /** Anula la venta: marca `VOIDED`, restaura el stock y crea los movimientos `VOID`. */
  async voidSale(
    id: string,
    dto: VoidSaleDto,
    userId: string,
  ): Promise<SaleDetailDto> {
    const reason = dto.reason.trim();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const sale = await tx.sale.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            items: { select: SALE_ITEM_SELECT },
          },
        });

        if (!sale) {
          throw new NotFoundException(SALE_NOT_FOUND);
        }

        if (sale.status === SaleStatus.VOIDED) {
          throw new ConflictException(SALE_ALREADY_VOIDED);
        }

        const productIds = [
          ...new Set(sale.items.map((item) => item.productId)),
        ].sort();

        for (const productId of productIds) {
          await tx.$queryRaw`SELECT id FROM "products" WHERE id = ${productId} FOR UPDATE`;
        }

        const voided = await tx.sale.updateMany({
          where: { id, status: SaleStatus.COMPLETED },
          data: {
            status: SaleStatus.VOIDED,
            voidedAt: new Date(),
            voidedById: userId,
            voidReason: reason,
          },
        });

        if (voided.count !== 1) {
          throw new ConflictException(SALE_ALREADY_VOIDED);
        }

        for (const item of sale.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { id: true, stock: true },
          });

          if (!product) {
            throw new NotFoundException(PRODUCT_NOT_FOUND);
          }

          await tx.product.update({
            where: { id: product.id },
            data: { stock: { increment: item.quantity } },
          });

          await tx.stockMovement.create({
            data: {
              productId: product.id,
              type: StockMovementType.VOID,
              quantity: item.quantity,
              previousStock: product.stock,
              newStock: product.stock + item.quantity,
              unitCost: item.unitCost,
              reason,
              saleId: id,
              userId,
            },
          });
        }

        const detail = await tx.sale.findUnique({
          where: { id },
          include: SALE_DETAIL_INCLUDE,
        });

        if (!detail) {
          throw new NotFoundException(SALE_NOT_FOUND);
        }

        return toSaleDetailDto(detail);
      });
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  /** Efectivo recibido en centavos, o `null` cuando el pago es con tarjeta. */
  private resolveCashReceived(
    payment: PaymentInputDto,
    totalCents: number,
  ): number | null {
    if (PAYMENT_METHOD_VALUES[payment.method] === PaymentMethod.CARD) {
      return null;
    }

    if (payment.cashReceived === undefined) {
      throw new BadRequestException(CASH_REQUIRED);
    }

    const receivedCents = toCents(payment.cashReceived);

    if (receivedCents < totalCents) {
      throw new BadRequestException(CASH_INSUFFICIENT);
    }

    return receivedCents;
  }

  /** Consume el consecutivo de ventas dentro de la transacción. */
  private async nextSaleNumber(tx: Prisma.TransactionClient): Promise<bigint> {
    const rows = await tx.$queryRaw<Array<{ value: bigint | string }>>`
      SELECT nextval('sale_number_seq') AS value
    `;
    const raw = rows[0]?.value;

    if (raw === undefined) {
      throw new Error('No se pudo obtener el consecutivo de la venta');
    }

    return typeof raw === 'bigint' ? raw : BigInt(raw);
  }

  /** Deja pasar los errores HTTP propios y traduce los de Prisma. */
  private toHttpError(error: unknown): Error {
    if (error instanceof HttpException) {
      return error;
    }

    if (prismaErrorCode(error) === RECORD_NOT_FOUND) {
      return new NotFoundException(SALE_NOT_FOUND);
    }

    return error instanceof Error
      ? error
      : new Error('Error inesperado al procesar la venta');
  }
}
