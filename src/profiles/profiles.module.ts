import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  imports: [
    UsersModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [ProfilesController],
  providers: [ProfilesService, JwtAuthGuard, RolesGuard],
})
export class ProfilesModule {}
