import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';
import { PaginatedSalesDto } from './dto/paginated-sales.dto.js';
import { QuerySalesDto, SALE_STATUSES } from './dto/query-sales.dto.js';
import { SaleDetailDto } from './dto/sale-response.dto.js';
import { VoidSaleDto } from './dto/void-sale.dto.js';
import { SalesService } from './sales.service.js';

const PRODUCT_UUID_EXAMPLE = '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f';
const SECOND_PRODUCT_UUID_EXAMPLE = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';

const SALE_ID_PARAM = {
  name: 'id',
  description: 'Identificador UUID de la venta.',
  format: 'uuid',
  example: '3c4d5e6f-7a8b-4c9d-9e0f-1a2b3c4d5e6f',
} as const;

const PROTECTED_RESPONSES = {
  unauthorized: {
    description: 'Sin access token válido (cookie `access_token` o Bearer).',
    type: ErrorResponseDto,
  },
  forbidden: {
    description:
      'El usuario autenticado no es `ADMIN` o el `Origin` no es `WEB_ORIGIN`.',
    type: ErrorResponseDto,
  },
} as const;

/** POS y ventas: registro, listado, detalle, comprobante y anulación. */
@ApiTags('Sales')
@ApiCookieAuth('access_token')
@Roles(Role.ADMIN)
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar venta',
    description: [
      'Registra una venta completa en una sola transacción: cabecera, líneas,',
      'pago, descuento de stock y un movimiento `SALE` por cada línea.',
      '',
      'Reglas:',
      '',
      '- `items`: de 1 a 100 productos **sin repetir**, con `quantity` entero',
      '  `>= 1`.',
      '- El precio y el costo se leen del producto en ese momento y quedan',
      '  **congelados** en la línea (`productName`, `sku`, `unitPrice`,',
      '  `unitCost`).',
      '- Todos los importes llevan el **IVA 19% incluido**: por línea,',
      '  `lineTax = lineTotal - round(lineTotal / 1.19)`.',
      '- `discountAmount` es un descuento global absoluto en COP que se',
      '  **prorratea** entre las líneas en proporción a su subtotal; el residuo',
      '  del redondeo se reparte de a un centavo, en orden. Nunca puede superar',
      '  el subtotal (`400`).',
      '- `payment.method`: `CASH` exige `cashReceived >= total` y calcula',
      '  `changeGiven = cashReceived - total`; `CARD` no admite `cashReceived`.',
      '- El **stock solo lo modifican los movimientos**: la venta lo descuenta',
      '  con un `updateMany` condicionado (si no alcanza, `409`) y crea un',
      '  `StockMovement` tipo `SALE` con cantidad negativa, stock anterior y',
      '  nuevo, costo unitario y el usuario autenticado.',
      '- `number` se toma de `sale_number_seq` y se expone como `V-000001`.',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiBody({
    type: CreateSaleDto,
    examples: {
      ventaEnEfectivo: {
        summary: 'Venta en efectivo de dos líneas con vuelto',
        value: {
          items: [
            { productId: PRODUCT_UUID_EXAMPLE, quantity: 2 },
            { productId: SECOND_PRODUCT_UUID_EXAMPLE, quantity: 1 },
          ],
          payment: { method: 'CASH', cashReceived: 40000 },
        },
      },
      ventaConTarjetaYDescuento: {
        summary: 'Venta con tarjeta y descuento global de 3.570 COP',
        value: {
          items: [{ productId: PRODUCT_UUID_EXAMPLE, quantity: 3 }],
          discountAmount: 3570,
          payment: { method: 'CARD' },
        },
      },
    },
  })
  @ApiCreatedResponse({
    description:
      'Venta registrada con sus líneas, el pago y los totales (IVA 19% incluido).',
    type: SaleDetailDto,
  })
  @ApiBadRequestResponse({
    description:
      'Payload inválido (items vacíos o repetidos, `quantity` no entero, descuento con más de dos decimales o mayor al subtotal), producto inactivo o eliminado, efectivo faltante y `cashReceived` en un pago con tarjeta.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  @ApiNotFoundResponse({
    description: 'Alguno de los productos no existe.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'Stock insuficiente para alguna línea (`Stock insuficiente para <SKU>`); la venta no se registra y el stock no cambia.',
    type: ErrorResponseDto,
  })
  async create(
    @Body() dto: CreateSaleDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<SaleDetailDto> {
    return this.sales.create(dto, currentUser.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar ventas',
    description: [
      'Listado paginado de ventas, de la más reciente a la más antigua',
      '(`createdAt desc, id desc`).',
      '',
      'Filtros:',
      '',
      '- `status`: `COMPLETED` (vigentes) o `VOIDED` (anuladas).',
      '- `from` / `to`: rango inclusive sobre `createdAt` en ISO 8601.',
      '',
      'Cada venta incluye `number` (`V-000001`), `itemCount`, `paymentMethod` y',
      'el usuario que la registró. Las anuladas siguen apareciendo con',
      '`status: VOIDED` (y su `voidedAt`), pero quedan **fuera de los KPIs** por',
      'ese mismo estado, así que se excluyen al filtrar por `COMPLETED`.',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Página solicitada (1-based).',
    example: 1,
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Ventas por página (máximo 100).',
    example: 20,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filtra por estado de la venta.',
    enum: SALE_STATUSES,
    example: 'COMPLETED',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Fecha inicial inclusive (ISO 8601, UTC).',
    example: '2026-02-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'Fecha final inclusive (ISO 8601, UTC).',
    example: '2026-02-28T23:59:59.999Z',
  })
  @ApiOkResponse({
    description: 'Página de ventas y metadatos de paginación.',
    type: PaginatedSalesDto,
  })
  @ApiBadRequestResponse({
    description:
      'Paginación, `status` o fechas ISO 8601 inválidas, o parámetros desconocidos.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  async list(@Query() query: QuerySalesDto): Promise<PaginatedSalesDto> {
    return this.sales.list(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle de venta',
    description: [
      'Devuelve la venta con sus **líneas** (snapshot del producto), su',
      '**pago** (`method`, `amount`, `cashReceived`, `changeGiven`), el usuario',
      'que la registró y, si está anulada, `voidedBy`, `voidedAt` y',
      '`voidReason`.',
      '',
      'Una venta anulada sigue consultable con `status: VOIDED`. Una venta',
      'inexistente responde `404`.',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiParam(SALE_ID_PARAM)
  @ApiOkResponse({
    description: 'Venta encontrada.',
    type: SaleDetailDto,
  })
  @ApiBadRequestResponse({
    description: 'El id no es un UUID válido.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  @ApiNotFoundResponse({
    description: 'La venta no existe.',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SaleDetailDto> {
    return this.sales.findOne(id);
  }

  @Get(':id/receipt')
  @ApiOperation({
    summary: 'Comprobante de venta',
    description: [
      'Devuelve el payload imprimible de la venta: número (`V-000001`), fecha,',
      'líneas, pago (`method`, `amount`, `cashReceived`, `changeGiven`) y',
      'totales (`subtotal`, `discountAmount`, `taxAmount` con IVA 19% incluido,',
      '`total`). Es el mismo `SaleDetailDto` del detalle, para que el',
      'comprobante y la consulta no se desincronicen.',
      '',
      'Una venta inexistente responde `404`.',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiParam(SALE_ID_PARAM)
  @ApiOkResponse({
    description: 'Comprobante de la venta (mismo detalle).',
    type: SaleDetailDto,
  })
  @ApiBadRequestResponse({
    description: 'El id no es un UUID válido.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  @ApiNotFoundResponse({
    description: 'La venta no existe.',
    type: ErrorResponseDto,
  })
  async receipt(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SaleDetailDto> {
    return this.sales.receipt(id);
  }

  @Post(':id/void')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Anular venta',
    description: [
      'Anula una venta `COMPLETED` en una sola transacción:',
      '',
      '- Bloquea los productos de la venta (`FOR UPDATE`) en orden ascendente de',
      '  id para restaurar el stock sin carreras.',
      '- Marca la venta como `VOIDED` con `voidedAt`, `voidedById` y `voidReason`',
      '  (`updateMany` condicionado a `status: COMPLETED`).',
      '- **Restaura el stock** de cada línea (`increment`) y crea un',
      '  `StockMovement` tipo `VOID` con cantidad positiva, stock anterior y',
      '  nuevo, el costo unitario de la línea y el motivo.',
      '',
      'Al quedar en `VOIDED`, la venta se excluye de los KPIs y ya no se puede',
      'anular de nuevo (`409`). Una venta inexistente responde `404`.',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiParam(SALE_ID_PARAM)
  @ApiBody({
    type: VoidSaleDto,
    examples: {
      errorDeDigitacion: {
        summary: 'Anular por error de digitación',
        value: { reason: 'Error de digitación del cajero' },
      },
      clienteDesistio: {
        summary: 'Anular porque el cliente desistió',
        value: { reason: 'Cliente desistió de la compra' },
      },
    },
  })
  @ApiOkResponse({
    description:
      'Venta anulada: stock restaurado y trazabilidad de la anulación.',
    type: SaleDetailDto,
  })
  @ApiBadRequestResponse({
    description:
      'Payload inválido o motivo fuera del rango de 3 a 255 caracteres.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  @ApiNotFoundResponse({
    description: 'La venta no existe.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'La venta ya estaba anulada (`status: VOIDED`).',
    type: ErrorResponseDto,
  })
  async voidSale(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidSaleDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<SaleDetailDto> {
    return this.sales.voidSale(id, dto, currentUser.id);
  }
}
