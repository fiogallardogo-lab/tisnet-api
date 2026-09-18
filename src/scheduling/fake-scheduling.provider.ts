import { Injectable } from '@nestjs/common';

import {
    CreateMeetingInput,
    GetAvailabilityInput,
    ScheduledMeetingResult,
    SchedulingProvider,
    SchedulingProviderError,
    SlotUnavailableError,
    TimeSlot,
} from './scheduling-provider.interface';

@Injectable()
export class FakeSchedulingProvider implements SchedulingProvider {
    private readonly availability = new Map<string, TimeSlot[]>();
    private readonly busySlots = new Map<string, TimeSlot[]>();
    private readonly scheduledMeetings: ScheduledMeetingResult[] = [];

    private shouldFail = false;
    private failureError: Error | null = null;
    private sequence = 0;

    async getAvailability(
        input: GetAvailabilityInput,
    ): Promise<TimeSlot[]> {
        this.throwIfFailure();

        const slots = this.availability.get(input.advisorId) ?? [];

        return slots
            .filter(
                (slot) =>
                    slot.start >= input.from &&
                    slot.end <= input.to &&
                    slot.status === 'AVAILABLE',
            )
            .map((slot) => ({
                ...slot,
                start: new Date(slot.start),
                end: new Date(slot.end),
            }));
    }

    async createMeeting(
        input: CreateMeetingInput,
    ): Promise<ScheduledMeetingResult> {
        this.throwIfFailure();

        if (input.end <= input.start) {
            throw new SlotUnavailableError(
                'Meeting end time must be after start time',
            );
        }

        const busy = this.busySlots.get(input.advisorId) ?? [];

        const hasConflict = busy.some(
            (slot) =>
                input.start < slot.end &&
                input.end > slot.start,
        );

        if (hasConflict) {
            throw new SlotUnavailableError(
                'Requested time slot is unavailable',
            );
        }

        this.sequence += 1;

        const meeting: ScheduledMeetingResult = {
            meetingId: `fake-meeting-${this.sequence}`,
            advisorId: input.advisorId,
            attendeeName: input.attendeeName,
            attendeeEmail: input.attendeeEmail,
            start: new Date(input.start),
            end: new Date(input.end),
            meetingUrl: `https://fake-scheduling.local/meeting/${this.sequence}`,
            quoteId: input.quoteId,
        };

        this.scheduledMeetings.push(meeting);

        this.addBusySlot(
            input.advisorId,
            input.start,
            input.end,
        );

        return {
            ...meeting,
            start: new Date(meeting.start),
            end: new Date(meeting.end),
        };
    }

    setAvailability(advisorId: string, slots: TimeSlot[]): void {
        this.availability.set(
            advisorId,
            slots.map((slot) => ({
                ...slot,
                start: new Date(slot.start),
                end: new Date(slot.end),
            })),
        );
    }

    addBusySlot(
        advisorId: string,
        start: Date,
        end: Date,
    ): void {
        const current = this.busySlots.get(advisorId) ?? [];

        current.push({
            start: new Date(start),
            end: new Date(end),
            status: 'BUSY',
        });

        this.busySlots.set(advisorId, current);
    }

    getScheduledMeetings(): ReadonlyArray<ScheduledMeetingResult> {
        return this.scheduledMeetings;
    }

    simulateFailure(shouldFail: boolean, error?: Error): void {
        this.shouldFail = shouldFail;
        this.failureError = shouldFail
            ? (error ??
                new SchedulingProviderError(
                    'Simulated scheduling provider failure',
                ))
            : null;
    }

    clear(): void {
        this.availability.clear();
        this.busySlots.clear();
        this.scheduledMeetings.length = 0;
        this.shouldFail = false;
        this.failureError = null;
        this.sequence = 0;
    }

    private throwIfFailure(): void {
        if (!this.shouldFail) {
            return;
        }

        throw (
            this.failureError ??
            new SchedulingProviderError(
                'Simulated scheduling provider failure',
            )
        );
    }
}