import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ClientPortalController } from './client-portal.controller';
import type { ClientPortalService } from './client-portal.service';

describe('ClientPortalController', () => {
  it('restricts the entire controller to CLIENT', () => {
    expect(Reflect.getMetadata('roles', ClientPortalController)).toEqual(['CLIENT']);
  });
  it('uses the authenticated account for reads and cancellation', () => {
    const service = { overview: vi.fn(), cancelMeeting: vi.fn() };
    const controller = new ClientPortalController(service as unknown as ClientPortalService);
    controller.overview({ user: { id: 7, email: 'lucia@example.test' } });
    controller.cancelMeeting({ user: { id: 7 } }, 4);
    expect(service.overview).toHaveBeenCalledWith({ id: 7, email: 'lucia@example.test' });
    expect(service.cancelMeeting).toHaveBeenCalledWith(7, 4);
  });
});
