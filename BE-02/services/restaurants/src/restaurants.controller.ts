import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateMenuItemDto, CreateRestaurantDto } from './dto';
import { RestaurantsService } from './restaurants.service';

@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurants: RestaurantsService) {}

  @Post('seed')
  seed() {
    return this.restaurants.seed();
  }

  @Get()
  findAll() {
    return this.restaurants.findAllRestaurants();
  }

  @Get(':id/menu')
  findMenu(@Param('id') id: string) {
    return this.restaurants.findMenu(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.restaurants.findRestaurant(id);
  }

  @Post()
  create(@Body() dto: CreateRestaurantDto) {
    return this.restaurants.createRestaurant(dto);
  }

  @Post(':id/menu')
  addMenuItem(@Param('id') id: string, @Body() dto: CreateMenuItemDto) {
    return this.restaurants.addMenuItem(id, dto);
  }

  @Patch('menu/:id/stock')
  updateStock(@Param('id') id: string, @Body('stock') stock: number) {
    return this.restaurants.updateStock(id, stock);
  }
}
