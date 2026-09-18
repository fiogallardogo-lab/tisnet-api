import {
    BadRequestException,
    Inject,
    Injectable,
} from '@nestjs/common';

import {
    ScheduledMeetingResult,
    SchedulingProvider,
    SCHEDULING_PROVIDER,
} from '../scheduling/scheduling-provider.interface';

export interface RequestMeetingInput {
    advisorId: string;
    attendeeName: string;
    attendeeEmail: string;
    start: Date;
    end: Date;
    quoteId?: string;
}

@Injectable()
export class MeetingsService {
    constructor(
        @Inject(SCHEDULING_PROVIDER)
        private readonly scheduling: SchedulingProvider,
    ) { }

    async requestMeeting(
        input: RequestMeetingInput,
    ): Promise<ScheduledMeetingResult> {
        this.validate(input);

        return this.scheduling.createMeeting({
            advisorId: input.advisorId,
            attendeeName: input.attendeeName,
            attendeeEmail: input.attendeeEmail,
            start: input.start,
            end: input.end,
            quoteId: input.quoteId,
        });
    }

    private validate(input: RequestMeetingInput): void {
        if (input.advisorId.trim() === '') {
            throw new BadRequestException(
                'El asesor es obligatorio',
            );
        }

        if (input.attendeeName.trim() === '') {
            throw new BadRequestException(
                'El nombre del cliente es obligatorio',
            );
        }

        if (input.attendeeEmail.trim() === '') {
            throw new BadRequestException(
                'El correo del cliente es obligatorio',
            );
        }

        if (Number.isNaN(input.start.getTime())) {
            throw new BadRequestException(
                'La fecha inicial no es válida',
            );
        }

        if (Number.isNaN(input.end.getTime())) {
            throw new BadRequestException(
                'La fecha final no es válida',
            );
        }

        if (input.start >= input.end) {
            throw new BadRequestException(
                'La fecha final debe ser posterior a la inicial',
            );
        }
    }
}