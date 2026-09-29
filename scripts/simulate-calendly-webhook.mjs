import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Cargar variables de entorno de .env si existe
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : fallback;
};

const eventType = getArg('event', 'created') === 'canceled' ? 'invitee.canceled' : 'invitee.created';
const attendeeEmail = getArg('email', 'cliente@tisnet.pe');
const attendeeName = getArg('name', 'Cliente Demostración');
const baseUrl = getArg('url', 'http://127.0.0.1:3000').replace(/\/+$/, '');
const endpoint = `${baseUrl}/api/v1/integrations/calendly/webhook`;
const secret = process.env.CALENDLY_WEBHOOK_SECRET || 'secret-simulacion-tisnet';

const now = new Date();
const startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString();

const payload = {
  event: eventType,
  created_at: now.toISOString(),
  payload: {
    event: 'https://api.calendly.com/scheduled_events/EVT-SIM-001',
    event_type: 'https://api.calendly.com/event_types/ET-SIM-001',
    invitee: {
      uri: 'https://api.calendly.com/scheduled_events/EVT-SIM-001/invitees/INV-SIM-001',
      email: attendeeEmail,
      name: attendeeName,
      status: 'active',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      cancellation: eventType === 'invitee.canceled' ? { reason: 'Reprogramación solicitada por el cliente' } : undefined,
    },
    scheduled_event: {
      uri: 'https://api.calendly.com/scheduled_events/EVT-SIM-001',
      name: 'Reunión de Kickoff / Asesoría TISNET',
      status: 'active',
      start_time: startTime,
      end_time: endTime,
      location: {
        type: 'googlemeet',
        join_url: 'https://meet.google.com/tis-demo-meet',
      },
    },
    tracking: {
      utm_content: 'advisor-tisnet',
      utm_term: 'Q-SIMULACION-2026',
    },
  },
};

const rawBody = JSON.stringify(payload);
const timestamp = Math.floor(Date.now() / 1000);
const signedPayload = `${timestamp}.${rawBody}`;
const signature = createHmac('sha256', secret).update(signedPayload).digest('hex');
const signatureHeader = `t=${timestamp},v1=${signature}`;

console.log('----------------------------------------------------');
console.log('🚀 [SIMULADOR CALENDLY] Enviando webhook simulado...');
console.log(`📡 URL Destino:      ${endpoint}`);
console.log(`📅 Tipo de Evento:   ${eventType}`);
console.log(`👤 Asistente:        ${attendeeName} <${attendeeEmail}>`);
console.log(`⏰ Horario Reunión:  ${startTime} -> ${endTime}`);
console.log(`🔐 Firma HMAC SHA256 generada: t=${timestamp},v1=${signature.slice(0, 10)}...`);
console.log('----------------------------------------------------');

try {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Calendly-Webhook-Signature': signatureHeader,
    },
    body: rawBody,
  });

  const bodyText = await response.text();
  console.log(`\n📬 Respuesta HTTP: ${response.status} ${response.statusText}`);

  if (response.ok) {
    console.log('✅ Webhook recibido y aceptado exitosamente por la API!');
    console.log(`📄 Cuerpo de respuesta: ${bodyText}`);
    console.log('✨ La notificación/correo de confirmación fue despachada por el backend.');
  } else {
    console.error(`❌ Error en la API (${response.status}): ${bodyText}`);
  }
} catch (error) {
  console.error('❌ Error de conexión al backend:', error.message);
  console.log('💡 Asegúrate de que la API esté corriendo en http://localhost:3000');
}
console.log('----------------------------------------------------');
