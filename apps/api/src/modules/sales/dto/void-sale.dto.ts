import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Anulación de una venta: exige un motivo trazable. */
export class VoidSaleDto {
  @ApiProperty({
    description:
      'Motivo de la anulación (de 3 a 255 caracteres). Se recorta antes de guardar y queda en `voidReason` y en los movimientos `VOID`.',
    example: 'Error de digitación del cajero',
    minLength: 3,
    maxLength: 255,
  })
  @Transform(trimString)
  @IsString({ message: 'reason debe ser texto' })
  @MinLength(3, { message: 'reason debe tener al menos 3 caracteres' })
  @MaxLength(255, { message: 'reason no puede superar 255 caracteres' })
  reason!: string;
}
