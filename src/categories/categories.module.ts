import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
    imports: [
        PrismaModule,
        PassportModule.register({
            defaultStrategy: 'jwt',
        }),
    ],
    controllers: [CategoriesController],
    providers: [CategoriesService, JwtAuthGuard, RolesGuard],
    exports: [CategoriesService],
})
export class CategoriesModule { }