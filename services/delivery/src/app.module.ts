import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RabbitModule } from '@nexvia/shared';
import { Delivery, DeliverySchema } from './delivery.schema';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI ?? 'mongodb://localhost:27017', {
      dbName: process.env.MONGODB_DB ?? 'nexvia_delivery',
    }),
    MongooseModule.forFeature([{ name: Delivery.name, schema: DeliverySchema }]),
    RabbitModule,
  ],
  controllers: [DeliveryController],
  providers: [DeliveryService],
})
export class AppModule {}
