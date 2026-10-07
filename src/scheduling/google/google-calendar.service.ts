import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CreateMeetingInput,
  GetAvailabilityInput,
  ScheduledMeetingResult,
  SchedulingProviderError,
  SlotUnavailableError,
  TimeSlot,
} from '../scheduling-provider.interface';

import { Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

const clean = (val?: string | null): string | undefined =>
  val ? val.trim().replace(/^["']|["']$/g, '') : undefined;

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private oauth2Client: OAuth2Client | null = null;
  private refreshToken: string | null = null;

  constructor(@Optional() private readonly configService?: ConfigService) {
    this.initOAuthClient();
  }

  private initOAuthClient(): void {
    const clientId = clean(
      this.configService?.get<string>('GOOGLE_CLIENT_ID') ??
        process.env.GOOGLE_CLIENT_ID,
    );
    const clientSecret = clean(
      this.configService?.get<string>('GOOGLE_CLIENT_SECRET') ??
        process.env.GOOGLE_CLIENT_SECRET,
    );
    const redirectUri =
      clean(
        this.configService?.get<string>('GOOGLE_REDIRECT_URI') ??
          process.env.GOOGLE_REDIRECT_URI,
      ) || 'http://localhost:3000/api/v1/integrations/google/callback';

    if (!clientId || !clientSecret) {
      this.logger.warn(
        '[GoogleCalendar] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Google Calendar integration is disabled.',
      );
      return;
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );

    // Initial check for refresh token in env or persisted token file
    const envToken = clean(
      this.configService?.get<string>('GOOGLE_REFRESH_TOKEN') ??
        process.env.GOOGLE_REFRESH_TOKEN,
    );
    if (envToken) {
      this.setRefreshToken(envToken);
    } else {
      this.loadStoredToken();
    }
  }

  private get tokenFilePath(): string {
    if (process.env.NODE_ENV === 'test') {
      return path.resolve(process.cwd(), '.google-token.test.json');
    }
    return path.resolve(process.cwd(), '.google-token.json');
  }

  private loadStoredToken(): void {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        const raw = fs.readFileSync(this.tokenFilePath, 'utf8');
        const data = JSON.parse(raw);
        if (data?.refresh_token) {
          this.setRefreshToken(data.refresh_token);
          this.logger.log('[GoogleCalendar] Refresh token loaded from storage.');
        }
      }
    } catch (err) {
      this.logger.warn(
        `[GoogleCalendar] Failed to load stored token: ${(err as Error).message}`,
      );
    }
  }

  private saveStoredToken(tokens: { refresh_token?: string | null }): void {
    if (!tokens.refresh_token) return;
    try {
      fs.writeFileSync(
        this.tokenFilePath,
        JSON.stringify({ refresh_token: tokens.refresh_token, updatedAt: new Date().toISOString() }, null, 2),
        'utf8',
      );
      this.logger.log('[GoogleCalendar] Refresh token persisted successfully.');
    } catch (err) {
      this.logger.warn(
        `[GoogleCalendar] Could not write token file: ${(err as Error).message}`,
      );
    }
  }

  public setRefreshToken(token: string): void {
    this.refreshToken = token;
    if (this.oauth2Client) {
      this.oauth2Client.setCredentials({ refresh_token: token });
    }
  }

  public isConfigured(): boolean {
    if (!this.oauth2Client) {
      this.initOAuthClient();
    }
    const clientId = clean(
      this.configService?.get<string>('GOOGLE_CLIENT_ID') ??
        process.env.GOOGLE_CLIENT_ID,
    );
    const clientSecret = clean(
      this.configService?.get<string>('GOOGLE_CLIENT_SECRET') ??
        process.env.GOOGLE_CLIENT_SECRET,
    );
    return Boolean(clientId && clientSecret);
  }

  public isAuthorized(): boolean {
    return Boolean(this.oauth2Client && this.refreshToken);
  }

  public generateAuthUrl(): string {
    if (!this.oauth2Client) {
      this.initOAuthClient();
    }
    if (!this.oauth2Client) {
      throw new SchedulingProviderError('Google OAuth2 client is not configured.');
    }

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES,
    });
  }

  public async handleCallback(code: string): Promise<{ success: boolean; refreshToken?: string }> {
    if (!this.oauth2Client) {
      throw new SchedulingProviderError('Google OAuth2 client is not configured.');
    }

    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);

    if (tokens.refresh_token) {
      this.setRefreshToken(tokens.refresh_token);
      this.saveStoredToken(tokens);
      return { success: true, refreshToken: tokens.refresh_token };
    }

    // If refresh token wasn't returned because of previous authorization without prompt=consent
    return { success: true };
  }

  private getCalendarClient() {
    if (!this.oauth2Client || !this.refreshToken) {
      throw new SchedulingProviderError(
        'Google Calendar no está autorizado. Inicie sesión en /api/v1/integrations/google/auth para vincular la cuenta.',
      );
    }
    return google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  public async createMeeting(
    input: CreateMeetingInput,
  ): Promise<ScheduledMeetingResult> {
    const calendar = this.getCalendarClient();
    const calendarId =
      clean(this.configService?.get<string>('GOOGLE_CALENDAR_ID')) ||
      clean(process.env.GOOGLE_CALENDAR_ID) ||
      'primary';

    if (input.end <= input.start) {
      throw new SlotUnavailableError('Meeting end time must be after start time');
    }

    try {
      const response = await calendar.events.insert({
        calendarId,
        conferenceDataVersion: 1, // Requests Google Meet conference generation
        requestBody: {
          summary: `Reunión TISNET: ${input.attendeeName}`,
          description: `Reunión de asesoría TISNET solicitada por ${input.attendeeName} (${input.attendeeEmail}).${
            input.quoteId ? `\nCotización asociada: ${input.quoteId}` : ''
          }`,
          start: {
            dateTime: input.start.toISOString(),
          },
          end: {
            dateTime: input.end.toISOString(),
          },
          attendees: [
            {
              email: input.attendeeEmail,
              displayName: input.attendeeName,
            },
          ],
          conferenceData: {
            createRequest: {
              requestId: randomUUID(),
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        },
      });

      const event = response.data;
      const meetingId = event.id ?? randomUUID();
      const meetingUrl =
        event.hangoutLink ??
        event.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === 'video')?.uri ??
        event.htmlLink ??
        '';

      this.logger.log(
        `[GoogleCalendar] Event created successfully ID=${meetingId} MeetUrl=${meetingUrl}`,
      );

      return {
        meetingId,
        advisorId: input.advisorId,
        attendeeName: input.attendeeName,
        attendeeEmail: input.attendeeEmail,
        start: input.start,
        end: input.end,
        meetingUrl,
        quoteId: input.quoteId,
      };
    } catch (error: any) {
      this.logger.error(
        `[GoogleCalendar] Error creating event: ${error?.message}`,
        error?.stack,
      );
      throw new SchedulingProviderError(
        `Error al crear reunión en Google Calendar: ${error?.message || 'Error desconocido'}`,
      );
    }
  }

  public async getAvailability(
    input: GetAvailabilityInput,
  ): Promise<TimeSlot[]> {
    const calendar = this.getCalendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

    try {
      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: input.from.toISOString(),
          timeMax: input.to.toISOString(),
          items: [{ id: calendarId }],
        },
      });

      const busyList = response.data.calendars?.[calendarId]?.busy ?? [];

      return busyList.map((slot) => ({
        start: new Date(slot.start ?? input.from),
        end: new Date(slot.end ?? input.to),
        status: 'BUSY' as const,
      }));
    } catch (error: any) {
      this.logger.error(
        `[GoogleCalendar] Error querying freeBusy: ${error?.message}`,
        error?.stack,
      );
      throw new SchedulingProviderError(
        `Error al consultar disponibilidad en Google Calendar: ${error?.message || 'Error desconocido'}`,
      );
    }
  }
}
