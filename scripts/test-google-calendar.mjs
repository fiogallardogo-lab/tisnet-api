import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import { randomUUID } from 'node:crypto';

dotenv.config();

const clean = (val) => (val ? val.trim().replace(/^["']|["']$/g, '') : undefined);

const clientId = clean(process.env.GOOGLE_CLIENT_ID);
const clientSecret = clean(process.env.GOOGLE_CLIENT_SECRET);
const redirectUri = clean(process.env.GOOGLE_REDIRECT_URI) || 'http://localhost:3000/api/v1/integrations/google/callback';
const refreshToken = clean(process.env.GOOGLE_REFRESH_TOKEN);
const calendarId = 'primary';

console.log('--- Probando integración con Google Calendar ---');
console.log('Calendar ID:', calendarId);

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
oauth2Client.setCredentials({ refresh_token: refreshToken });

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

async function test() {
  const startTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hora en el futuro
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 min duración

  console.log(`Creando reunión de prueba para: ${startTime.toISOString()} ...`);

  const response = await calendar.events.insert({
    calendarId,
    conferenceDataVersion: 1,
    requestBody: {
      summary: 'Prueba Integración TISNET - Asesoría Comercial',
      description: 'Reunión de prueba creada automáticamente desde TISNET API.',
      start: { dateTime: startTime.toISOString() },
      end: { dateTime: endTime.toISOString() },
      attendees: [
        { email: 'cliente.prueba@tisnet.test', displayName: 'Cliente Prueba' }
      ],
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    }
  });

  const event = response.data;
  console.log(' ¡Evento creado exitosamente en Google Calendar!');
  console.log('ID del Evento:', event.id);
  console.log('Enlace de Google Meet:', event.hangoutLink || 'Generando enlace...');
  console.log('Enlace del Evento:', event.htmlLink);
}

test().catch((err) => {
  console.error(' Error en la prueba:', err.message);
  process.exit(1);
});
