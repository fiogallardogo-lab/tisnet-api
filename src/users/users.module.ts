import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommercialModule } from '../commercial/commercial.module';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    CommercialModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
