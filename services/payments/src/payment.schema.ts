import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PaymentStatus } from '@nexvia/shared';

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({ timestamps: true, collection: 'payments' })
export class Payment {
  @Prop({ required: true, unique: true, index: true })
  orderId!: string;

  @Prop({ required: true })
  amount!: number;

  @Prop({ type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.Pending })
  status!: PaymentStatus;

  @Prop({ default: 'demo-card' })
  method!: string;

  @Prop({ default: '' })
  failureReason!: string;

  @Prop({ default: '' })
  refundReason!: string;

  @Prop({ required: true })
  correlationId!: string;

  @Prop({ type: [String], default: [] })
  processedEvents!: string[];
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.processedEvents;
  },
});
