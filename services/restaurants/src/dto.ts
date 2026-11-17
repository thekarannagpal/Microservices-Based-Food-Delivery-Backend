import { IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateRestaurantDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  cuisine!: string;

  @IsString()
  address!: string;

  @IsNumber()
  @IsOptional()
  rating?: number;
}

export class CreateMenuItemDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsInt()
  @Min(0)
  stock!: number;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}
