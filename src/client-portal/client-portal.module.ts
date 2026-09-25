import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { ClientPortalController } from './client-portal.controller';
import { ClientPortalService } from './client-portal.service';

@Module({
  imports: [PrismaModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [ClientPortalController],
  providers: [ClientPortalService, JwtAuthGuard, RolesGuard],
})
export class ClientPortalModule {}
