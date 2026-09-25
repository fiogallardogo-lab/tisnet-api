import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { mergeMap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { auditRecord } from './audit.service';
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest();
    const controller = ctx.getClass().name;
    const type: Record<string, string> = {
      UsersController: 'USER',
      ProfilesController: 'USER',
      ProjectsController: 'PROJECT',
      DeliverablesController: 'DELIVERABLE',
    };
    const entityType =
      type[controller] ||
      (controller === 'AuthController' && ctx.getHandler().name === 'register'
        ? 'USER'
        : undefined);
    if (!entityType || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method))
      return next.handle();
    return next.handle().pipe(
      mergeMap(async (value) => {
        const data = value?.data ?? value;
        await auditRecord(this.prisma, {
          actorId: req.user?.id,
          action: `${req.method}_${ctx.getHandler().name}`
            .toUpperCase()
            .slice(0, 100),
          entityType,
          entityId: String(
            data?.id ??
              data?.user?.id ??
              req.params?.id ??
              req.params?.projectId ??
              req.user?.id ??
              'collection',
          ),
          metadata: { method: req.method },
        });
        return value;
      }),
    );
  }
}
