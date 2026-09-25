import { IntakeModule } from './public-intake/intake.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    CategoriesModule,
    TechnologiesModule,
    ProjectsModule,
    ServicesModule,
    IntakeModule,
    ProfilesModule,
    QuotesModule.register({ catalog: quotesCatalogV1 }),
    ProspectsModule,
    StorageModule,
    NotificationsModule,
    SchedulingModule,
    DocumentsModule,
    MeetingsModule,
    DeliverablesModule,
    TeamApplicationsModule,
    PaymentsModule,
    BusinessDaysModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
