export const SCHEDULING_PROVIDER = Symbol('SCHEDULING_PROVIDER');

export type SlotStatus = 'AVAILABLE' | 'BUSY';

export interface TimeSlot {
    start: Date;
    end: Date;
    status: SlotStatus;
}

export interface GetAvailabilityInput {
    advisorId: string;
    from: Date;
    to: Date;
}

export interface CreateMeetingInput {
    advisorId: string;
    attendeeName: string;
    attendeeEmail: string;
    start: Date;
    end: Date;
    quoteId?: string;
}

export interface ScheduledMeetingResult {
    meetingId: string;
    advisorId: string;
    attendeeName: string;
    attendeeEmail: string;
    start: Date;
    end: Date;
    meetingUrl: string;
    quoteId?: string;
}

export interface SchedulingProvider {
    getAvailability(input: GetAvailabilityInput): Promise<TimeSlot[]>;

    createMeeting(
        input: CreateMeetingInput,
    ): Promise<ScheduledMeetingResult>;
}

export class SlotUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SlotUnavailableError';
    }
}

export class SchedulingProviderError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SchedulingProviderError';
    }
}