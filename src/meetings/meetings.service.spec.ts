import { beforeEach, describe, expect, it } from 'vitest';

import { MeetingsService } from './meetings.service';
import { FakeSchedulingProvider } from '../scheduling/fake-scheduling.provider';
import {
    SchedulingProviderError,
    SlotUnavailableError,
} from '../scheduling/scheduling-provider.interface';

describe('MeetingsService', () => {
    let scheduling: FakeSchedulingProvider;
    let service: MeetingsService;

    const validInput = {
        advisorId: 'advisor-1',
        attendeeName: 'Cliente Demo',
        attendeeEmail: 'cliente@tisnet.test',
        start: new Date('2026-09-21T15:00:00.000Z'),
        end: new Date('2026-09-21T16:00:00.000Z'),
        quoteId: 'quote-1',
    };

    beforeEach(() => {
        scheduling = new FakeSchedulingProvider();
        service = new MeetingsService(scheduling);
    });

    it('crea una reunión correctamente', async () => {
        const result = await service.requestMeeting(validInput);

        expect(result.meetingId).toBe('fake-meeting-1');
        expect(result.advisorId).toBe('advisor-1');
        expect(result.attendeeName).toBe('Cliente Demo');
        expect(result.attendeeEmail).toBe('cliente@tisnet.test');
        expect(result.quoteId).toBe('quote-1');

        expect(scheduling.getScheduledMeetings()).toHaveLength(1);
    });

    it('permite crear una reunión sin quoteId', async () => {
        const result = await service.requestMeeting({
            ...validInput,
            quoteId: undefined,
        });

        expect(result.meetingId).toBe('fake-meeting-1');
        expect(result.quoteId).toBeUndefined();
    });

    it('rechaza un advisorId vacío', async () => {
        await expect(
            service.requestMeeting({
                ...validInput,
                advisorId: '   ',
            }),
        ).rejects.toThrow('El asesor es obligatorio');

        expect(scheduling.getScheduledMeetings()).toHaveLength(0);
    });

    it('rechaza un nombre de cliente vacío', async () => {
        await expect(
            service.requestMeeting({
                ...validInput,
                attendeeName: '   ',
            }),
        ).rejects.toThrow('El nombre del cliente es obligatorio');

        expect(scheduling.getScheduledMeetings()).toHaveLength(0);
    });

    it('rechaza un correo vacío', async () => {
        await expect(
            service.requestMeeting({
                ...validInput,
                attendeeEmail: '   ',
            }),
        ).rejects.toThrow('El correo del cliente es obligatorio');

        expect(scheduling.getScheduledMeetings()).toHaveLength(0);
    });

    it('rechaza una fecha inicial inválida', async () => {
        await expect(
            service.requestMeeting({
                ...validInput,
                start: new Date('invalid'),
            }),
        ).rejects.toThrow('La fecha inicial no es válida');
    });

    it('rechaza una fecha final inválida', async () => {
        await expect(
            service.requestMeeting({
                ...validInput,
                end: new Date('invalid'),
            }),
        ).rejects.toThrow('La fecha final no es válida');
    });

    it('rechaza una fecha final igual o anterior a la inicial', async () => {
        await expect(
            service.requestMeeting({
                ...validInput,
                end: new Date('2026-09-21T15:00:00.000Z'),
            }),
        ).rejects.toThrow(
            'La fecha final debe ser posterior a la inicial',
        );
    });

    it('propaga un conflicto de horario del SchedulingProvider', async () => {
        scheduling.addBusySlot(
            'advisor-1',
            new Date('2026-09-21T15:00:00.000Z'),
            new Date('2026-09-21T16:00:00.000Z'),
        );

        await expect(
            service.requestMeeting(validInput),
        ).rejects.toBeInstanceOf(SlotUnavailableError);

        expect(scheduling.getScheduledMeetings()).toHaveLength(0);
    });

    it('propaga un error del proveedor de agenda', async () => {
        scheduling.simulateFailure(
            true,
            new SchedulingProviderError('provider unavailable'),
        );

        await expect(
            service.requestMeeting(validInput),
        ).rejects.toThrow('provider unavailable');

        expect(scheduling.getScheduledMeetings()).toHaveLength(0);
    });

    it('permite solicitudes independientes para distintos asesores', async () => {
        const first = await service.requestMeeting(validInput);

        const second = await service.requestMeeting({
            ...validInput,
            advisorId: 'advisor-2',
            attendeeName: 'Segundo Cliente',
            attendeeEmail: 'segundo@tisnet.test',
            quoteId: undefined,
        });

        expect(first.meetingId).toBe('fake-meeting-1');
        expect(second.meetingId).toBe('fake-meeting-2');
        expect(scheduling.getScheduledMeetings()).toHaveLength(2);
    });
});