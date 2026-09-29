import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { DeliverablesController } from './deliverables.controller';
import { MilestonesController } from './milestones.controller';
import { DeliverablesService } from './deliverables.service';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    StorageModule,
  ],
  controllers: [DeliverablesController, MilestonesController],
  providers: [DeliverablesService, JwtAuthGuard, RolesGuard],
  exports: [DeliverablesService],
})
export class DeliverablesModule {}
