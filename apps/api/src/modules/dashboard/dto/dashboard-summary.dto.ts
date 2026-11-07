import { ApiProperty } from '@nestjs/swagger';

/** Rango de fechas efectivamente aplicado al reporte (ISO 8601, UTC). */
export class DashboardRangeResponseDto {
  @ApiProperty({
    description:
      'Inicio del rango, inclusive (ISO 8601, UTC). Por defecto, 30 días antes de `to`.',
    example: '2026-02-01T00:00:00.000Z',
  })
  from!: string;

  @ApiProperty({
    description:
      'Fin del rango, inclusive (ISO 8601, UTC). Por defecto, el momento de la consulta.',
    example: '2026-02-28T23:59:59.999Z',
  })
  to!: string;
}

/** KPIs de ventas, pérdidas e inventario del rango consultado. */
export class DashboardSummaryDto {
  @ApiProperty({
    description:
      'Rango aplicado (por defecto, los últimos 30 días). Todas las cifras de ventas usan solo ventas `COMPLETED` con `createdAt` dentro del rango.',
    type: DashboardRangeResponseDto,
  })
  range!: DashboardRangeResponseDto;

  @ApiProperty({
    description:
      'Ventas totales en COP: `sum(Sale.total)` con el **IVA 19% incluido** (ya descontado el descuento).',
    example: 169000,
    minimum: 0,
  })
  totalSales!: number;

  @ApiProperty({
    description:
      'Ventas brutas en COP: `sum(Sale.subtotal)`, es decir el **subtotal con IVA incluido y antes del descuento**. Siempre mayor o igual que `totalSales`.',
    example: 172000,
    minimum: 0,
  })
  grossSales!: number;

  @ApiProperty({
    description:
      'Ventas netas en COP **sin IVA**: `sum(Sale.total - Sale.taxAmount)`. Es la base del margen y, por definición, `netSales = grossProfit + costOfSales`.',
    example: 142016.81,
    minimum: 0,
  })
  netSales!: number;

  @ApiProperty({
    description:
      'Costo de lo vendido en COP: `sum(Sale.costTotal)` (costo unitario congelado en cada línea por la cantidad).',
    example: 106900,
    minimum: 0,
  })
  costOfSales!: number;

  @ApiProperty({
    description:
      'Ganancia bruta en COP: `sum(Sale.profit)`, equivalente a `netSales - costOfSales`.',
    example: 35116.81,
  })
  grossProfit!: number;

  @ApiProperty({
    description:
      'Margen bruto en porcentaje: `grossProfit / netSales * 100` con dos decimales; `0` cuando `netSales = 0`.',
    example: 24.73,
  })
  margin!: number;

  @ApiProperty({
    description:
      'Ticket promedio en COP: `totalSales / transactionCount` con dos decimales; `0` cuando no hay ventas.',
    example: 42250,
    minimum: 0,
  })
  averageTicket!: number;

  @ApiProperty({
    description:
      'Cantidad de ventas `COMPLETED` del rango. Las anuladas (`VOIDED`) nunca cuentan.',
    example: 4,
    minimum: 0,
  })
  transactionCount!: number;

  @ApiProperty({
    description: 'Descuentos otorgados en COP: `sum(Sale.discountAmount)`.',
    example: 3000,
    minimum: 0,
  })
  discounts!: number;

  @ApiProperty({
    description:
      'Mermas en COP: `sum(abs(StockMovement.quantity) * StockMovement.unitCost)` de los movimientos `ADJUSTMENT` con `quantity < 0` del rango (las ventas y las anulaciones no cuentan).',
    example: 3600,
    minimum: 0,
  })
  shrinkage!: number;

  @ApiProperty({
    description:
      'Pérdidas en COP: `shrinkage + discounts` (mermas de inventario más descuentos otorgados).',
    example: 6600,
    minimum: 0,
  })
  losses!: number;

  @ApiProperty({
    description:
      'Valorización en COP del inventario actual: `sum(Product.stock * Product.costPrice)` de los productos activos y no eliminados. **No** depende del rango de fechas.',
    example: 339300,
    minimum: 0,
  })
  inventoryValue!: number;

  @ApiProperty({
    description:
      'Productos activos y no eliminados con `stock <= minStock` (incluye los agotados). Fotografía actual, sin filtro de fecha.',
    example: 2,
    minimum: 0,
  })
  lowStockCount!: number;

  @ApiProperty({
    description:
      'Productos activos y no eliminados con `stock = 0`. Fotografía actual, sin filtro de fecha.',
    example: 1,
    minimum: 0,
  })
  outOfStockCount!: number;
}
