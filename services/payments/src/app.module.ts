import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RabbitModule } from '@nexvia/shared';
import { Payment, PaymentSchema } from './payment.schema';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI ?? 'mongodb://localhost:27017', {
      dbName: process.env.MONGODB_DB ?? 'nexvia_payments',
    }),
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
    RabbitModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class AppModule {}
