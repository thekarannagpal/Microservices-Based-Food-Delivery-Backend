import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  menuItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsString()
  @IsNotEmpty()
  restaurantId!: string;

  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

export class CancelOrderDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
