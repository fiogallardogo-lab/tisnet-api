import { beforeEach, describe, expect, it } from 'vitest';

import { FakeSchedulingProvider } from './fake-scheduling.provider';
import {
    SchedulingProviderError,
    SlotUnavailableError,
    TimeSlot,
} from './scheduling-provider.interface';

describe('FakeSchedulingProvider', () => {
    let provider: FakeSchedulingProvider;

    const advisorId = 'advisor-1';

    const availableSlot: TimeSlot = {
        start: new Date('2026-09-21T15:00:00.000Z'),
        end: new Date('2026-09-21T16:00:00.000Z'),
        status: 'AVAILABLE',
    };

    beforeEach(() => {
        provider = new FakeSchedulingProvider();
    });

    it('devuelve los horarios disponibles dentro del rango solicitado', async () => {
        provider.setAvailability(advisorId, [
            availableSlot,
            {
                start: new Date('2026-09-21T17:00:00.000Z'),
                end: new Date('2026-09-21T18:00:00.000Z'),
                status: 'AVAILABLE',
            },
        ]);

        const result = await provider.getAvailability({
            advisorId,
            from: new Date('2026-09-21T14:00:00.000Z'),
            to: new Date('2026-09-21T16:30:00.000Z'),
        });

        expect(result).toHaveLength(1);
        expect(result[0].start.toISOString()).toBe(
            '2026-09-21T15:00:00.000Z',
        );
        expect(result[0].end.toISOString()).toBe(
            '2026-09-21T16:00:00.000Z',
        );
    });

    it('crea una reunión correctamente', async () => {
        const result = await provider.createMeeting({
            advisorId,
            attendeeName: 'Cliente Demo',
            attendeeEmail: 'cliente@tisnet.test',
            start: new Date('2026-09-21T15:00:00.000Z'),
            end: new Date('2026-09-21T16:00:00.000Z'),
            quoteId: 'quote-1',
        });

        expect(result.meetingId).toBe('fake-meeting-1');
        expect(result.advisorId).toBe(advisorId);
        expect(result.attendeeName).toBe('Cliente Demo');
        expect(result.attendeeEmail).toBe('cliente@tisnet.test');
        expect(result.quoteId).toBe('quote-1');
        expect(result.meetingUrl).toBe(
            'https://fake-scheduling.local/meeting/1',
        );

        expect(provider.getScheduledMeetings()).toHaveLength(1);
    });

    it('marca automáticamente como ocupado el horario de una reunión creada', async () => {
        await provider.createMeeting({
            advisorId,
            attendeeName: 'Cliente Demo',
            attendeeEmail: 'cliente@tisnet.test',
            start: new Date('2026-09-21T15:00:00.000Z'),
            end: new Date('2026-09-21T16:00:00.000Z'),
        });

        await expect(
            provider.createMeeting({
                advisorId,
                attendeeName: 'Segundo Cliente',
                attendeeEmail: 'segundo@tisnet.test',
                start: new Date('2026-09-21T15:30:00.000Z'),
                end: new Date('2026-09-21T16:30:00.000Z'),
            }),
        ).rejects.toBeInstanceOf(SlotUnavailableError);
    });

    it('rechaza un horario previamente marcado como ocupado', async () => {
        provider.addBusySlot(
            advisorId,
            new Date('2026-09-21T15:00:00.000Z'),
            new Date('2026-09-21T16:00:00.000Z'),
        );

        await expect(
            provider.createMeeting({
                advisorId,
                attendeeName: 'Cliente Demo',
                attendeeEmail: 'cliente@tisnet.test',
                start: new Date('2026-09-21T15:30:00.000Z'),
                end: new Date('2026-09-21T16:30:00.000Z'),
            }),
        ).rejects.toThrow('Requested time slot is unavailable');
    });

    it('permite reuniones consecutivas sin considerarlas conflicto', async () => {
        provider.addBusySlot(
            advisorId,
            new Date('2026-09-21T15:00:00.000Z'),
            new Date('2026-09-21T16:00:00.000Z'),
        );

        const result = await provider.createMeeting({
            advisorId,
            attendeeName: 'Cliente Demo',
            attendeeEmail: 'cliente@tisnet.test',
            start: new Date('2026-09-21T16:00:00.000Z'),
            end: new Date('2026-09-21T17:00:00.000Z'),
        });

        expect(result.meetingId).toBe('fake-meeting-1');
    });

    it('rechaza una reunión cuya hora final no sea posterior a la inicial', async () => {
        await expect(
            provider.createMeeting({
                advisorId,
                attendeeName: 'Cliente Demo',
                attendeeEmail: 'cliente@tisnet.test',
                start: new Date('2026-09-21T16:00:00.000Z'),
                end: new Date('2026-09-21T16:00:00.000Z'),
            }),
        ).rejects.toThrow(
            'Meeting end time must be after start time',
        );
    });

    it('genera identificadores deterministas e incrementales', async () => {
        const first = await provider.createMeeting({
            advisorId: 'advisor-1',
            attendeeName: 'Cliente 1',
            attendeeEmail: 'cliente1@tisnet.test',
            start: new Date('2026-09-21T15:00:00.000Z'),
            end: new Date('2026-09-21T16:00:00.000Z'),
        });

        const second = await provider.createMeeting({
            advisorId: 'advisor-2',
            attendeeName: 'Cliente 2',
            attendeeEmail: 'cliente2@tisnet.test',
            start: new Date('2026-09-21T15:00:00.000Z'),
            end: new Date('2026-09-21T16:00:00.000Z'),
        });

        expect(first.meetingId).toBe('fake-meeting-1');
        expect(second.meetingId).toBe('fake-meeting-2');
    });

    it('permite simular una caída del proveedor externo', async () => {
        provider.simulateFailure(
            true,
            new SchedulingProviderError('scheduling API unavailable'),
        );

        await expect(
            provider.getAvailability({
                advisorId,
                from: new Date('2026-09-21T14:00:00.000Z'),
                to: new Date('2026-09-21T18:00:00.000Z'),
            }),
        ).rejects.toThrow('scheduling API unavailable');

        await expect(
            provider.createMeeting({
                advisorId,
                attendeeName: 'Cliente Demo',
                attendeeEmail: 'cliente@tisnet.test',
                start: new Date('2026-09-21T15:00:00.000Z'),
                end: new Date('2026-09-21T16:00:00.000Z'),
            }),
        ).rejects.toThrow('scheduling API unavailable');
    });

    it('clear reinicia disponibilidad, reuniones, secuencia y errores', async () => {
        provider.setAvailability(advisorId, [availableSlot]);

        await provider.createMeeting({
            advisorId,
            attendeeName: 'Cliente Demo',
            attendeeEmail: 'cliente@tisnet.test',
            start: new Date('2026-09-21T15:00:00.000Z'),
            end: new Date('2026-09-21T16:00:00.000Z'),
        });

        provider.simulateFailure(true);

        provider.clear();

        expect(provider.getScheduledMeetings()).toHaveLength(0);

        const availability = await provider.getAvailability({
            advisorId,
            from: new Date('2026-09-21T14:00:00.000Z'),
            to: new Date('2026-09-21T18:00:00.000Z'),
        });

        expect(availability).toEqual([]);

        const result = await provider.createMeeting({
            advisorId,
            attendeeName: 'Nuevo Cliente',
            attendeeEmail: 'nuevo@tisnet.test',
            start: new Date('2026-09-21T17:00:00.000Z'),
            end: new Date('2026-09-21T18:00:00.000Z'),
        });

        expect(result.meetingId).toBe('fake-meeting-1');
    });
});