import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, HydratedDocument } from 'mongoose';

export type MenuItemDocument = HydratedDocument<MenuItem>;

@Schema({ timestamps: true, collection: 'menu_items' })
export class MenuItem {
  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ required: true, min: 0, default: 0 })
  stock!: number;

  @Prop({ default: true })
  isAvailable!: boolean;
}

export const MenuItemSchema = SchemaFactory.createForClass(MenuItem);
MenuItemSchema.index({ restaurantId: 1, name: 1 }, { unique: true });
MenuItemSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    ret.restaurantId = String(ret.restaurantId);
    delete ret._id;
    delete ret.__v;
  },
});

@Schema({ timestamps: true, collection: 'processed_reservations' })
export class ProcessedReservation {
  @Prop({ required: true, unique: true })
  orderId!: string;
}

export const ProcessedReservationSchema = SchemaFactory.createForClass(ProcessedReservation);
