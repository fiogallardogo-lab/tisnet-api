import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicServicesController } from './public-services.controller';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  imports: [PrismaModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [ServicesController, PublicServicesController],
  providers: [ServicesService, JwtAuthGuard, RolesGuard],
  exports: [ServicesService],
})
export class ServicesModule {}
