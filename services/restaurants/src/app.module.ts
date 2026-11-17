import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RabbitModule } from '@nexvia/shared';
import { InventoryConsumer } from './inventory.consumer';
import { MenuItem, MenuItemSchema, ProcessedReservation, ProcessedReservationSchema } from './menu-item.schema';
import { PricingGrpcController } from './pricing.grpc';
import { Restaurant, RestaurantSchema } from './restaurant.schema';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantsService } from './restaurants.service';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI ?? 'mongodb://localhost:27017', {
      dbName: process.env.MONGODB_DB ?? 'nexvia_restaurants',
    }),
    MongooseModule.forFeature([
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: MenuItem.name, schema: MenuItemSchema },
      { name: ProcessedReservation.name, schema: ProcessedReservationSchema },
    ]),
    RabbitModule,
  ],
  controllers: [RestaurantsController, PricingGrpcController],
  providers: [RestaurantsService, InventoryConsumer],
})
export class AppModule {}
