import { PaymentsModule } from '../payments/payments.module';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { PublicProjectsController } from './public-projects.controller';

@Module({
  imports: [
    PaymentsModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [ProjectsController, PublicProjectsController],
  providers: [ProjectsService, JwtAuthGuard, RolesGuard],
  exports: [ProjectsService],
})
export class ProjectsModule {}
