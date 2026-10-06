import { PaymentsModule } from '../payments/payments.module';
import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { ClientPortalController } from './client-portal.controller';
import { ClientPortalService } from './client-portal.service';
import { ClientQuotesController } from './client-quotes.controller';
import { ClientQuotesService } from './client-quotes.service';
import { ClientPaymentsController } from './client-payments.controller';
import { ClientPaymentsService } from './client-payments.service';
import { CommercialModule } from '../commercial/commercial.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { KickoffModule } from '../kickoff/kickoff.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    PaymentsModule,
    PrismaModule,
    CommercialModule,
    NotificationsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    forwardRef(() => KickoffModule),
    forwardRef(() => ProjectsModule),
  ],
  controllers: [ClientPortalController, ClientQuotesController, ClientPaymentsController],
  providers: [ClientPortalService, ClientQuotesService, ClientPaymentsService, JwtAuthGuard, RolesGuard],
})
export class ClientPortalModule {}
