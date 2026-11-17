import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LoginDto, RegisterUserDto } from './dto';
import { User } from './user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
  }

  private verifyPassword(password: string, stored: string): boolean {
    const [salt, expected] = stored.split(':');
    if (!salt || !expected) return false;
    const actual = scryptSync(password, salt, 64);
    const expectedBuffer = Buffer.from(expected, 'hex');
    return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
  }

  async register(dto: RegisterUserDto) {
    try {
      const user = await this.userModel.create({ ...dto, passwordHash: this.hashPassword(dto.password) });
      return user.toJSON();
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (!user || !this.verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return user.toJSON();
  }

  async findById(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user.toJSON();
  }

  async findAll() {
    return this.userModel.find();
  }
}
