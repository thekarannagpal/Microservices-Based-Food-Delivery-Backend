import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { OrderStatus } from '@nexvia/shared';

export type OrderDocument = HydratedDocument<Order>;

@Schema({ _id: false })
export class OrderItem {
  @Prop({ required: true })
  menuItemId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  quantity!: number;

  @Prop({ required: true })
  unitPrice!: number;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({ required: true, index: true })
  customerId!: string;

  @Prop({ required: true, index: true })
  restaurantId!: string;

  @Prop({ type: [OrderItemSchema], required: true })
  items!: OrderItem[];

  @Prop({ required: true })
  subtotal!: number;

  @Prop({ required: true })
  deliveryFee!: number;

  @Prop({ required: true })
  tax!: number;

  @Prop({ required: true })
  totalAmount!: number;

  @Prop({ type: String, enum: Object.values(OrderStatus), default: OrderStatus.PendingPayment, index: true })
  status!: OrderStatus;

  @Prop({ default: '' })
  reason!: string;

  @Prop({ default: '' })
  paymentId!: string;

  @Prop({ default: '' })
  deliveryId!: string;

  @Prop({ default: '' })
  courierName!: string;

  @Prop({ default: 0 })
  etaMinutes!: number;

  @Prop({ required: true })
  correlationId!: string;

  @Prop({ type: [String], default: [] })
  processedEvents!: string[];
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.processedEvents;
  },
});
