import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { TechnologiesModule } from './technologies/technologies.module.js';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, CategoriesModule, TechnologiesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
