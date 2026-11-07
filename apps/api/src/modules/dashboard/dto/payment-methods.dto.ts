import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '../../../generated/prisma/client.js';
import { DashboardRangeResponseDto } from './dashboard-summary.dto.js';

/** Cobros de un método de pago dentro del rango. */
export class PaymentMethodBreakdownDto {
  @ApiProperty({
    description: 'Método de pago: `CASH` (efectivo) o `CARD` (tarjeta).',
    enum: PaymentMethod,
    enumName: 'PaymentMethod',
    example: PaymentMethod.CASH,
  })
  method!: PaymentMethod;

  @ApiProperty({
    description:
      'Cantidad de pagos con ese método entre las ventas `COMPLETED` del rango.',
    example: 2,
    minimum: 0,
  })
  transactions!: number;

  @ApiProperty({
    description:
      'Importe cobrado con ese método en COP: `sum(Payment.amount)`, IVA incluido.',
    example: 127000,
    minimum: 0,
  })
  amount!: number;
}

/** Totales de todos los métodos de pago del rango. */
export class PaymentMethodsTotalDto {
  @ApiProperty({
    description: 'Pagos registrados en el rango (igual a `transactionCount`).',
    example: 4,
    minimum: 0,
  })
  transactions!: number;

  @ApiProperty({
    description: 'Importe total cobrado en COP (igual a `totalSales`).',
    example: 169000,
    minimum: 0,
  })
  amount!: number;
}

/** Distribución de los cobros por método de pago. */
export class PaymentMethodsDto {
  @ApiProperty({
    description: 'Rango aplicado al reporte (ISO 8601, UTC).',
    type: DashboardRangeResponseDto,
  })
  range!: DashboardRangeResponseDto;

  @ApiProperty({
    description:
      'Un elemento por método soportado, siempre en el orden `CASH` y `CARD`; los métodos sin cobros aparecen con `0` en `transactions` y `amount`.',
    type: () => [PaymentMethodBreakdownDto],
  })
  data!: PaymentMethodBreakdownDto[];

  @ApiProperty({
    description: 'Suma de todos los métodos.',
    type: PaymentMethodsTotalDto,
  })
  total!: PaymentMethodsTotalDto;
}
