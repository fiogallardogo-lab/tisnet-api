import {
  Controller,
  Get,
  Query,
  Res,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { GoogleCalendarService } from './google-calendar.service';

@Controller('integrations/google')
export class GoogleCalendarController {
  constructor(private readonly service: GoogleCalendarService) {}

  @Get('auth')
  initiateAuth(@Res() res: Response): void {
    if (!this.service.isConfigured()) {
      throw new BadRequestException(
        'Google OAuth2 no está configurado en las variables de entorno (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).',
      );
    }
    const url = this.service.generateAuthUrl();
    res.redirect(url);
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (error) {
      res.status(400).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2 style="color: #e53e3e;">Error al autorizar con Google</h2>
            <p>${error}</p>
          </body>
        </html>
      `);
      return;
    }

    if (!code) {
      throw new BadRequestException('El código de autorización es requerido.');
    }

    try {
      const result = await this.service.handleCallback(code);
      res.status(200).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2 style="color: #38a169;">¡Google Calendar vinculado exitosamente!</h2>
            <p>TISNET ahora puede programar reuniones y generar enlaces de Google Meet automáticamente.</p>
            ${
              result.refreshToken
                ? `<p style="font-size: 13px; color: #718096;">Token de refresco configurado correctamente.</p>`
                : ''
            }
            <p style="margin-top: 30px;"><a href="javascript:window.close()" style="color: #3182ce;">Cerrar esta ventana</a></p>
          </body>
        </html>
      `);
    } catch (err: any) {
      res.status(500).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h2 style="color: #e53e3e;">Error al procesar la autorización</h2>
            <p>${err?.message || 'Error desconocido'}</p>
          </body>
        </html>
      `);
    }
  }

  @Get('status')
  @HttpCode(200)
  getStatus(): { configured: boolean; authorized: boolean } {
    return {
      configured: this.service.isConfigured(),
      authorized: this.service.isAuthorized(),
    };
  }
}
