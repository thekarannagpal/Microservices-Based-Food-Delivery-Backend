import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export enum DeliveryStatus {
  Requested = 'REQUESTED',
  Assigned = 'ASSIGNED',
  PickedUp = 'PICKED_UP',
  Delivered = 'DELIVERED',
}

export type DeliveryDocument = HydratedDocument<Delivery>;

@Schema({ timestamps: true, collection: 'deliveries' })
export class Delivery {
  @Prop({ required: true, unique: true, index: true })
  orderId!: string;

  @Prop({ required: true })
  customerId!: string;

  @Prop({ required: true })
  restaurantId!: string;

  @Prop({ default: 'Customer address on file' })
  address!: string;

  @Prop({ type: String, enum: Object.values(DeliveryStatus), default: DeliveryStatus.Requested })
  status!: DeliveryStatus;

  @Prop({ default: '' })
  courierName!: string;

  @Prop({ default: 0 })
  etaMinutes!: number;

  @Prop({ required: true })
  correlationId!: string;

  @Prop({ type: [String], default: [] })
  processedEvents!: string[];
}

export const DeliverySchema = SchemaFactory.createForClass(Delivery);
DeliverySchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.processedEvents;
  },
});
