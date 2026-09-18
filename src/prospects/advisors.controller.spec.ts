import { describe, expect, it, vi } from 'vitest';
import { PublicAdvisorsController } from './public-advisors.controller.js';
import { AdvisorsAdminController } from './advisors-admin.controller.js';

describe('Advisors Controllers', () => {
  const prospectsService = {
    findPublicAdvisors: vi.fn(),
    setAdvisorVisibility: vi.fn(),
  };

  describe('PublicAdvisorsController', () => {
    const controller = new PublicAdvisorsController(prospectsService as never);

    it('delega findPublicAdvisors al servicio', async () => {
      prospectsService.findPublicAdvisors.mockResolvedValue([{ id: 1, name: 'Asesor' }]);

      const result = await controller.findAll();
      expect(prospectsService.findPublicAdvisors).toHaveBeenCalled();
      expect(result).toEqual([{ id: 1, name: 'Asesor' }]);
    });
  });

  describe('AdvisorsAdminController', () => {
    const controller = new AdvisorsAdminController(prospectsService as never);

    it('delega setAdvisorVisibility con profileId y valor booleano', async () => {
      prospectsService.setAdvisorVisibility.mockResolvedValue({ id: 2, isPublicAdvisor: true });

      const result = await controller.setVisibility(2, { isPublicAdvisor: true });
      expect(prospectsService.setAdvisorVisibility).toHaveBeenCalledWith(2, true);
      expect(result).toEqual({ id: 2, isPublicAdvisor: true });
    });
  });
});
