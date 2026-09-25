import { Global, Module } from '@nestjs/common';
import { AUDIT_PROVIDER } from './audit-provider.interface';
import { InMemoryAuditProvider } from './in-memory-audit.provider';
import { AuditService } from './audit.service';

@Global()
@Module({
  providers: [
    InMemoryAuditProvider,
    {
      provide: AUDIT_PROVIDER,
      useExisting: InMemoryAuditProvider,
    },
    AuditService,
  ],
  exports: [AUDIT_PROVIDER, AuditService],
})
export class AuditModule {}
