import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { AUDIT_PROVIDER } from './audit-provider.interface';
import { InMemoryAuditProvider } from './in-memory-audit.provider';

@Global()
@Module({
  imports: [PrismaModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [
    AuditService,
    InMemoryAuditProvider,
    {
      provide: AUDIT_PROVIDER,
      useExisting: InMemoryAuditProvider,
    },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  controllers: [AuditController],
  exports: [AuditService, AUDIT_PROVIDER],
})
export class AuditModule {}
