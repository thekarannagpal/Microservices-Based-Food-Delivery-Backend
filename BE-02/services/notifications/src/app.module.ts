import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RabbitModule } from '@nexvia/shared';
import { Notification, NotificationSchema } from './notification.schema';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI ?? 'mongodb://localhost:27017', {
      dbName: process.env.MONGODB_DB ?? 'nexvia_notifications',
    }),
    MongooseModule.forFeature([{ name: Notification.name, schema: NotificationSchema }]),
    RabbitModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class AppModule {}
