import { THROTTLER_LIMIT } from '@nestjs/throttler/dist/throttler.constants';
import { PublicCatalogModule } from './dashboard/public-catalog.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { WorkModule } from './work/work.module';
import { CommercialOperationsModule } from './commercial-operations/operations.module';
import { CommercialModule } from './commercial/commercial.module';
import { KickoffModule } from './kickoff/kickoff.module';
import { ClientPortalModule } from './client-portal/client-portal.module';
import { IntakeModule } from './public-intake/intake.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { TechnologiesModule } from './technologies/technologies.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { ServicesModule } from './services/services.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { QuotesModule } from './quotes/quotes.module.js';
import { quotesCatalogV1 } from './quotes/catalog/quotes-catalog-v1.js';
import { ProspectsModule } from './prospects/prospects.module.js';
import { StorageModule } from './storage/storage.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { SchedulingModule } from './scheduling/scheduling.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { MeetingsModule } from './meetings/meetings.module.js';
import { DeliverablesModule } from './deliverables/deliverables.module.js';
import { TeamApplicationsModule } from './team-applications/team-applications.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { BusinessDaysModule } from './common/business-days/business-days.module.js';
import { AuditModule } from './audit/audit.module.js';
import { SignedUrlModule } from './common/signed-urls/signed-url.module.js';
import { SlaAlertsModule } from './common/sla-alerts/sla-alerts.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { ContributionsModule } from './contributions/contributions.module.js';

@Module({
  imports: [
    PublicCatalogModule,
    DashboardModule,
    WorkModule,
    CommercialOperationsModule,
    CommercialModule,
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    /**
     * Rate limiting � global defaults (overridable per-route with @Throttle()).
     *
     * Profiles:
     *   default  � 120 req / 60 s  (general API)
     *   auth     � 10  req / 60 s  (login, forgot-password, reset-password)
     *   public   � 30  req / 60 s  (public quote, public meeting booking)
     *   webhook  � 60  req / 60 s  (Culqi/Calendly webhooks � higher burst allowed)
     */
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 120 },
      {
        name: 'auth', ttl: 60000, limit: 10,
        // Named profiles otherwise apply to every route, including calendars.
        skipIf: (context) =>
          ![context.getHandler(), context.getClass()].some((target) =>
            Reflect.hasMetadata(THROTTLER_LIMIT + 'auth', target),
          ),
      },
      { name: 'public', ttl: 60000, limit: 30 },
      { name: 'webhook', ttl: 60000, limit: 60 },
    ]),
    PrismaModule,
    ProfilesModule,
    UsersModule,
    AuthModule,
    CategoriesModule,
    TechnologiesModule,
    ProjectsModule,
    ServicesModule,
    IntakeModule,
    QuotesModule.register({ catalog: quotesCatalogV1 }),
    ProspectsModule,
    PaymentsModule,
    KickoffModule,
    AuditModule,
    StorageModule,
    NotificationsModule,
    SchedulingModule,
    DocumentsModule,
    MeetingsModule,
    DeliverablesModule,
    ClientPortalModule,
    TeamApplicationsModule,
    BusinessDaysModule,
    SignedUrlModule,
    SlaAlertsModule,
    ReportsModule,
    ContributionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Apply the throttler globally; individual controllers can use
    // @SkipThrottle() or @Throttle({ auth: { ... } }) to override.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
