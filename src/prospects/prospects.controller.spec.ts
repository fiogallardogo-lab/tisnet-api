import { describe, expect, it, vi } from 'vitest';
import { ProspectsController } from './prospects.controller.js';
import { ProspectStatus } from '@prisma/client';

describe('ProspectsController', () => {
  const prospectsService = {
    linkQuote: vi.fn(),
    findOwn: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    updateStatus: vi.fn(),
  };

  const controller = new ProspectsController(prospectsService as never);

  it('delega linkQuote con datos del usuario autenticado', async () => {
    prospectsService.linkQuote.mockResolvedValue({ id: 1 });
    const req = { user: { id: 10, email: 'cliente@test.com', role: 'CLIENT' } };

    const result = await controller.linkQuote(req, { publicCode: 'Q-ABCDEFGH' });
    expect(prospectsService.linkQuote).toHaveBeenCalledWith(10, 'cliente@test.com', 'Q-ABCDEFGH');
    expect(result).toEqual({ id: 1 });
  });

  it('delega findOwn con el id del usuario autenticado', async () => {
    prospectsService.findOwn.mockResolvedValue({ id: 1 });
    const req = { user: { id: 10, email: 'cliente@test.com', role: 'CLIENT' } };

    const result = await controller.findOwn(req);
    expect(prospectsService.findOwn).toHaveBeenCalledWith(10);
    expect(result).toEqual({ id: 1 });
  });

  it('delega findAll con el query param', async () => {
    const query = { page: 1, limit: 10 };
    prospectsService.findAll.mockResolvedValue({ items: [], meta: {} });

    const result = await controller.findAll(query as never);
    expect(prospectsService.findAll).toHaveBeenCalledWith(query);
    expect(result).toEqual({ items: [], meta: {} });
  });

  it('delega findOne con el id', async () => {
    prospectsService.findOne.mockResolvedValue({ id: 5 });

    const result = await controller.findOne(5);
    expect(prospectsService.findOne).toHaveBeenCalledWith(5);
    expect(result).toEqual({ id: 5 });
  });

  it('delega updateStatus con el id y estado', async () => {
    prospectsService.updateStatus.mockResolvedValue({ id: 5, status: ProspectStatus.QUALIFIED });

    const result = await controller.updateStatus(5, { status: ProspectStatus.QUALIFIED });
    expect(prospectsService.updateStatus).toHaveBeenCalledWith(5, ProspectStatus.QUALIFIED);
    expect(result).toEqual({ id: 5, status: ProspectStatus.QUALIFIED });
  });
});
