import { resolve } from 'node:path';
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MongooseModule } from '@nestjs/mongoose';
import { RabbitModule } from '@nexvia/shared';
import { Order, OrderSchema } from './order.schema';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI ?? 'mongodb://localhost:27017', {
      dbName: process.env.MONGODB_DB ?? 'nexvia_orders',
    }),
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    RabbitModule,
    ClientsModule.register([
      {
        name: 'PRICING_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'pricing',
          protoPath: resolve(__dirname, '..', '..', '..', 'proto', 'pricing.proto'),
          url: process.env.PRICING_GRPC_URL ?? 'localhost:50051',
        },
      },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class AppModule {}
