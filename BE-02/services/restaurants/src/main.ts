import 'reflect-metadata';
import { resolve } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { tracingMiddleware } from '@nexvia/shared';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.use(tracingMiddleware(process.env.SERVICE_NAME ?? 'restaurants'));
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'pricing',
      protoPath: resolve(__dirname, '..', '..', '..', 'proto', 'pricing.proto'),
      url: '0.0.0.0:50051',
    },
  });
  await app.startAllMicroservices();
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}
void bootstrap();
