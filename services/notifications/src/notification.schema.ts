import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ required: true, unique: true })
  eventId!: string;

  @Prop({ required: true, index: true })
  orderId!: string;

  @Prop({ required: true })
  type!: string;

  @Prop({ required: true })
  channel!: string;

  @Prop({ required: true })
  message!: string;

  @Prop({ required: true })
  correlationId!: string;

  @Prop({ required: true })
  traceId!: string;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});
