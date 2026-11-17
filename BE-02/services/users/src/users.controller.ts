import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LoginDto, RegisterUserDto } from './dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post('register')
  register(@Body() dto: RegisterUserDto) {
    return this.users.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.users.login(dto);
  }

  @Get()
  findAll() {
    return this.users.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.users.findById(id);
  }
}
