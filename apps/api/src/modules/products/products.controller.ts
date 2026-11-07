import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
  ApiNoContentResponse,
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
import { CreateProductDto } from './dto/create-product.dto.js';
import { PaginatedPriceHistoryDto } from './dto/paginated-price-history.dto.js';
import { PaginatedProductsDto } from './dto/paginated-products.dto.js';
import { ProductResponseDto } from './dto/product-response.dto.js';
import {
  PRODUCT_SORT_FIELDS,
  QueryProductsDto,
  SORT_ORDERS,
} from './dto/query-products.dto.js';
import { QueryPriceHistoryDto } from './dto/query-price-history.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductsService } from './products.service.js';

const PRODUCT_ID_PARAM = {
  name: 'id',
  description: 'Identificador UUID del producto.',
  format: 'uuid',
  example: '7f0e1d2c-3b4a-4f5e-8d9c-0b1a2c3d4e5f',
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

/** Catálogo de productos: todo el módulo exige rol `ADMIN`. */
@ApiTags('Products')
@ApiCookieAuth('access_token')
@Roles(Role.ADMIN)
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar productos',
    description: [
      'Listado paginado del catálogo (excluye productos eliminados lógicamente).',
      '',
      'Filtros:',
      '',
      '- `search`: parcial e insensible a mayúsculas sobre **nombre**, **SKU** y',
      '  **código de barras**.',
      '- `categoryId`: UUID de la categoría.',
      '- `active`: `true` (activos) o `false` (inactivos).',
      '- `lowStock`: `true` devuelve `stock <= minStock`; `false`, los que están',
      '  por encima del mínimo.',
      '',
      'Orden: `sort` (`name`, `salePrice`, `stock`, `createdAt`) y `order`',
      '(`asc`, `desc`); por defecto `createdAt desc`. Cada producto incluye su',
      'categoría y el indicador `lowStock`.',
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
    description: 'Elementos por página (máximo 100).',
    example: 20,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Búsqueda parcial por nombre, SKU o código de barras.',
    example: 'agua',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Filtra por UUID de categoría.',
    format: 'uuid',
    example: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
  })
  @ApiQuery({
    name: 'active',
    required: false,
    description: 'Filtra por estado del producto.',
    enum: ['true', 'false'],
    example: 'true',
  })
  @ApiQuery({
    name: 'lowStock',
    required: false,
    description: 'Filtra productos en o por debajo del stock mínimo.',
    enum: ['true', 'false'],
    example: 'true',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    description: 'Campo de ordenamiento.',
    enum: PRODUCT_SORT_FIELDS,
    example: 'name',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    description: 'Dirección del ordenamiento.',
    enum: SORT_ORDERS,
    example: 'asc',
  })
  @ApiOkResponse({
    description: 'Página de productos y metadatos de paginación.',
    type: PaginatedProductsDto,
  })
  @ApiBadRequestResponse({
    description: 'Filtros, orden o paginación inválidos.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  async list(@Query() query: QueryProductsDto): Promise<PaginatedProductsDto> {
    return this.products.list(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear producto',
    description: [
      'Crea un producto del catálogo con **stock inicial `0`**.',
      '',
      '- `sku` es obligatorio y único (se recorta y se guarda en mayúsculas).',
      '- `barcode` es opcional y único.',
      '- `categoryId` debe existir y estar **activa**; si no, responde `400`.',
      '- `costPrice`, `salePrice` y `minStock` deben ser `>= 0`.',
      '- Enviar `stock` responde `400`: el inventario se gestiona con',
      '  movimientos (Fase 4).',
      '',
      'Se registran los precios iniciales `COST` y `SALE` en el historial',
      '(valor anterior `0`) con el usuario que crea el producto.',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiBody({
    type: CreateProductDto,
    examples: {
      bebida: {
        summary: 'Producto con precio en COP',
        value: {
          sku: 'BEB-001',
          barcode: '7701000000011',
          name: 'Agua Cristal 600 ml',
          description: 'Agua purificada sin gas, botella de 600 ml',
          categoryId: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
          costPrice: 1200,
          salePrice: 2000,
          minStock: 24,
          unit: 'botella',
          imageUrl: 'https://cdn.pos.local/products/agua-cristal-600ml.png',
          active: true,
        },
      },
      sinCodigoBarras: {
        summary: 'Producto sin código de barras',
        value: {
          sku: 'SNK-014',
          name: 'Papas Margarita Pollo 105 g',
          categoryId: '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f',
          costPrice: 1800,
          salePrice: 3000,
          minStock: 10,
          unit: 'paquete',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Producto creado (stock `0`).',
    type: ProductResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Payload inválido, `stock` presente, categoría inexistente o inactiva.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  @ApiConflictResponse({
    description: 'SKU o código de barras duplicado.',
    type: ErrorResponseDto,
  })
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ProductResponseDto> {
    return this.products.create(dto, currentUser.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle de producto',
    description: [
      'Devuelve un producto no eliminado con su categoría y el indicador',
      '`lowStock` (`stock <= minStock`).',
      '',
      'Un producto eliminado lógicamente o inexistente responde `404`.',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiParam(PRODUCT_ID_PARAM)
  @ApiOkResponse({
    description: 'Producto encontrado.',
    type: ProductResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'El id no es un UUID válido.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  @ApiNotFoundResponse({
    description: 'El producto no existe o fue eliminado.',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductResponseDto> {
    return this.products.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar producto',
    description: [
      'Actualización parcial del catálogo: `sku`, `barcode`, `name`,',
      '`description`, `categoryId`, `costPrice`, `salePrice`, `minStock`, `unit`,',
      '`imageUrl` y `active`.',
      '',
      '- **`stock` no se puede cambiar aquí**: enviarlo responde `400`.',
      '- Si cambia `costPrice` o `salePrice`, se crea un registro en',
      '  `PriceHistory` con el valor anterior, el nuevo y el usuario que lo',
      '  cambió, en la **misma transacción**.',
      '- `sku` y `barcode` siguen siendo únicos (`409` si se repiten).',
      '- La nueva categoría debe existir y estar activa (`400`).',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiParam(PRODUCT_ID_PARAM)
  @ApiBody({
    type: UpdateProductDto,
    examples: {
      precioYNombre: {
        summary: 'Cambiar precio de venta y nombre',
        value: {
          name: 'Agua Cristal 600 ml (nueva presentación)',
          salePrice: 2200,
        },
      },
      soloCosto: {
        summary: 'Cambiar solo el costo',
        value: { costPrice: 1300 },
      },
      desactivar: {
        summary: 'Desactivar producto',
        value: { active: false },
      },
    },
  })
  @ApiOkResponse({
    description: 'Producto actualizado.',
    type: ProductResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Payload vacío o inválido, `stock` presente, categoría inexistente o inactiva.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  @ApiNotFoundResponse({
    description: 'El producto no existe o fue eliminado.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'El SKU o el código de barras ya pertenece a otro producto.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<ProductResponseDto> {
    return this.products.update(id, dto, currentUser.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar producto (borrado lógico)',
    description: [
      'Aplica borrado lógico: `active = false` y `deletedAt = now()`. El',
      'producto deja de aparecer en el listado y su detalle responde `404`.',
      '',
      'La operación es **idempotente**: repetirla sobre un producto ya eliminado',
      'sigue respondiendo `204`.',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiParam(PRODUCT_ID_PARAM)
  @ApiNoContentResponse({
    description: 'Producto eliminado; sin contenido en el body.',
  })
  @ApiBadRequestResponse({
    description: 'El id no es un UUID válido.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  @ApiNotFoundResponse({
    description: 'El producto nunca existió.',
    type: ErrorResponseDto,
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.products.remove(id);
  }

  @Get(':id/price-history')
  @ApiOperation({
    summary: 'Historial de precios',
    description: [
      'Devuelve los cambios de precio del producto paginados y ordenados del más',
      'reciente al más antiguo.',
      '',
      'Al crear un producto se registran dos entradas iniciales (`COST` y `SALE`)',
      'con valor anterior `0`. Cada cambio posterior guarda `oldValue` y',
      '`newValue` junto con `changedBy` (`id`, `name`, `email`).',
      '',
      'Un producto inexistente o eliminado responde `404`.',
      '',
      'Solo `ADMIN`.',
    ].join('\n'),
  })
  @ApiParam(PRODUCT_ID_PARAM)
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Página solicitada (1-based).',
    example: 1,
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Registros por página (máximo 100).',
    example: 20,
  })
  @ApiOkResponse({
    description: 'Página del historial de precios.',
    type: PaginatedPriceHistoryDto,
  })
  @ApiBadRequestResponse({
    description: 'Paginación inválida o id no UUID.',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse(PROTECTED_RESPONSES.unauthorized)
  @ApiForbiddenResponse(PROTECTED_RESPONSES.forbidden)
  @ApiNotFoundResponse({
    description: 'El producto no existe o fue eliminado.',
    type: ErrorResponseDto,
  })
  async priceHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryPriceHistoryDto,
  ): Promise<PaginatedPriceHistoryDto> {
    return this.products.priceHistory(id, query);
  }
}
