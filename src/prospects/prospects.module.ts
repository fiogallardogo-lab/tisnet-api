import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { ProspectsController } from './prospects.controller';
import { ProspectsService } from './prospects.service';
import { PublicAdvisorsController } from './public-advisors.controller';
import { AdvisorsAdminController } from './advisors-admin.controller';

@Module({
  imports: [PrismaModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [
    ProspectsController,
    PublicAdvisorsController,
    AdvisorsAdminController,
  ],
  providers: [ProspectsService, JwtAuthGuard, RolesGuard],
  exports: [ProspectsService],
})
export class ProspectsModule {}
