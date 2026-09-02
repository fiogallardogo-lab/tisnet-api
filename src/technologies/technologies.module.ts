import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { TechnologiesController } from './technologies.controller';
import { TechnologiesService } from './technologies.service';

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
    controllers: [TechnologiesController],
    providers: [TechnologiesService, JwtAuthGuard, RolesGuard],
    exports: [TechnologiesService],
})
export class TechnologiesModule { }
