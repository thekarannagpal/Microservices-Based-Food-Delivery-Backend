import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import type { QuoteItemMessage, QuoteLineMessage, QuoteResponseMessage } from '@nexvia/shared';
import { CreateMenuItemDto, CreateRestaurantDto } from './dto';
import { MenuItem, ProcessedReservation } from './menu-item.schema';
import { Restaurant } from './restaurant.schema';

const DELIVERY_FEE = 39;
const TAX_RATE = 0.05;
const round2 = (value: number) => Math.round(value * 100) / 100;

export interface ReservationResult {
  ok: boolean;
  reason?: string;
  alreadyProcessed?: boolean;
  lines?: QuoteLineMessage[];
}

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectModel(Restaurant.name) private readonly restaurantModel: Model<Restaurant>,
    @InjectModel(MenuItem.name) private readonly menuModel: Model<MenuItem>,
    @InjectModel(ProcessedReservation.name) private readonly reservationModel: Model<ProcessedReservation>,
  ) {}

  async createRestaurant(dto: CreateRestaurantDto) {
    return this.restaurantModel.create(dto);
  }

  async findAllRestaurants() {
    // Return documents so the toJSON transform exposes `id` instead of `_id`.
    return this.restaurantModel.find();
  }

  async findRestaurant(id: string) {
    if (!isValidObjectId(id)) throw new NotFoundException('Restaurant not found');
    const restaurant = await this.restaurantModel.findById(id);
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    return restaurant;
  }

  async addMenuItem(restaurantId: string, dto: CreateMenuItemDto) {
    await this.findRestaurant(restaurantId);
    return this.menuModel.create({ ...dto, restaurantId: new Types.ObjectId(restaurantId) });
  }

  async findMenu(restaurantId: string) {
    await this.findRestaurant(restaurantId);
    return this.menuModel.find({ restaurantId: new Types.ObjectId(restaurantId) });
  }

  async updateStock(menuItemId: string, stock: number) {
    if (!isValidObjectId(menuItemId)) throw new NotFoundException('Menu item not found');
    const item = await this.menuModel.findByIdAndUpdate(menuItemId, { stock }, { new: true });
    if (!item) throw new NotFoundException('Menu item not found');
    return item;
  }

  /** Shared pricing logic used by the gRPC endpoint and stock reservation. */
  async getQuote(restaurantId: string, items: QuoteItemMessage[]): Promise<QuoteResponseMessage> {
    const response: QuoteResponseMessage = {
      restaurantId,
      lines: [],
      subtotal: 0,
      deliveryFee: DELIVERY_FEE,
      tax: 0,
      total: 0,
      currency: 'INR',
    };

    if (!items.length) return { ...response, error: 'Cart is empty' };
    if (!isValidObjectId(restaurantId) || items.some((item) => !isValidObjectId(item.menuItemId))) {
      return { ...response, error: 'Invalid restaurant or menu item id' };
    }

    const ids = items.map((item) => new Types.ObjectId(item.menuItemId));
    const docs = await this.menuModel.find({
      _id: { $in: ids },
      restaurantId: new Types.ObjectId(restaurantId),
      isAvailable: true,
    });
    const byId = new Map(docs.map((doc) => [String(doc._id), doc]));

    const lines: QuoteLineMessage[] = [];
    for (const item of items) {
      const doc = byId.get(item.menuItemId);
      if (!doc) return { ...response, error: `Menu item ${item.menuItemId} is not available at this restaurant` };
      if (item.quantity < 1 || !Number.isInteger(item.quantity)) {
        return { ...response, error: 'Quantity must be a positive integer' };
      }
      lines.push({
        menuItemId: item.menuItemId,
        name: doc.name,
        quantity: item.quantity,
        unitPrice: doc.price,
        lineTotal: round2(doc.price * item.quantity),
      });
    }

    const subtotal = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));
    const tax = round2(subtotal * TAX_RATE);
    return { ...response, lines, subtotal, tax, total: round2(subtotal + DELIVERY_FEE + tax) };
  }

  /** Decrements stock atomically; rolls back partial reservations on failure. */
  async reserveStock(orderId: string, restaurantId: string, items: QuoteItemMessage[]): Promise<ReservationResult> {
    try {
      await this.reservationModel.create({ orderId });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) return { ok: true, alreadyProcessed: true };
      throw error;
    }

    const quote = await this.getQuote(restaurantId, items);
    if (quote.error) {
      await this.reservationModel.deleteOne({ orderId });
      return { ok: false, reason: quote.error };
    }

    const decremented: QuoteLineMessage[] = [];
    for (const line of quote.lines) {
      const result = await this.menuModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(line.menuItemId),
          restaurantId: new Types.ObjectId(restaurantId),
          stock: { $gte: line.quantity },
          isAvailable: true,
        },
        { $inc: { stock: -line.quantity } },
        { new: true },
      );
      if (!result) {
        for (const previous of decremented) {
          await this.menuModel.updateOne({ _id: new Types.ObjectId(previous.menuItemId) }, { $inc: { stock: previous.quantity } });
        }
        await this.reservationModel.deleteOne({ orderId });
        return { ok: false, reason: `Insufficient stock for ${line.name}` };
      }
      decremented.push(line);
    }
    return { ok: true, lines: quote.lines };
  }

  async seed() {
    if ((await this.restaurantModel.countDocuments()) > 0) {
      return { restaurants: await this.restaurantModel.countDocuments(), menuItems: await this.menuModel.countDocuments(), seeded: false };
    }

    const catalog = [
      {
        name: 'Curry Leaf',
        cuisine: 'Indian',
        address: '12 Spice Market Road',
        rating: 4.7,
        menu: [
          { name: 'Butter Chicken', description: 'Creamy tomato curry', price: 320, stock: 20 },
          { name: 'Garlic Naan', description: 'Tandoor-baked bread', price: 60, stock: 50 },
          { name: 'Hyderabadi Biryani', description: 'Fragrant rice with chicken', price: 280, stock: 8 },
        ],
      },
      {
        name: 'Pizza Pilgrim',
        cuisine: 'Italian',
        address: '8 Baker Street',
        rating: 4.5,
        menu: [
          { name: 'Margherita', description: 'Tomato, mozzarella, basil', price: 299, stock: 15 },
          { name: 'Pepperoni', description: 'Spicy pepperoni', price: 359, stock: 10 },
          { name: 'Garlic Bread', description: ' cheesy garlic sticks', price: 149, stock: 30 },
        ],
      },
      {
        name: 'Green Bowl',
        cuisine: 'Healthy',
        address: '5 Garden Lane',
        rating: 4.3,
        menu: [
          { name: 'Caesar Salad', description: 'Crisp greens and dressing', price: 249, stock: 12 },
          { name: 'Poke Bowl', description: 'Salmon, rice, avocado', price: 349, stock: 6 },
        ],
      },
    ];

    let menuItems = 0;
    for (const entry of catalog) {
      const restaurant = await this.restaurantModel.create({
        name: entry.name,
        cuisine: entry.cuisine,
        address: entry.address,
        rating: entry.rating,
      });
      await this.menuModel.insertMany(
        entry.menu.map((item) => ({ ...item, restaurantId: restaurant._id })),
      );
      menuItems += entry.menu.length;
    }
    return { restaurants: catalog.length, menuItems, seeded: true };
  }
}
