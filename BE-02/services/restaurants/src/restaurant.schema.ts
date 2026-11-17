import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RestaurantDocument = HydratedDocument<Restaurant>;

@Schema({ timestamps: true, collection: 'restaurants' })
export class Restaurant {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  cuisine!: string;

  @Prop({ required: true })
  address!: string;

  @Prop({ default: 4.5 })
  rating!: number;

  @Prop({ default: true })
  isActive!: boolean;
}

export const RestaurantSchema = SchemaFactory.createForClass(Restaurant);
RestaurantSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});
