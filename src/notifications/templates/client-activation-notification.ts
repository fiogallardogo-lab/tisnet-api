import { escapeHtml } from './escape-html';

export interface ClientActivationEmailInput {
  recipientName: string;
  recipientEmail: string;
  password: string;
  loginUrl: string;
  company?: string | null;
  quoteCode?: string | null;
  solutionType?: string | null;
}

export function renderClientActivationEmail(input: ClientActivationEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const safeName = escapeHtml(input.recipientName || 'Cliente');
  const safeEmail = escapeHtml(input.recipientEmail);
  const safePassword = escapeHtml(input.password);
  const safeLoginUrl = input.loginUrl.replace(/"/g, '&quot;');
  const safeQuoteCode = input.quoteCode ? escapeHtml(input.quoteCode) : null;
  const safeCompany = input.company ? escapeHtml(input.company) : null;

  const subject = '¡Tu cuenta ha sido activada! — Credenciales de acceso TISNET';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 28px; text-align: center; }
    .logo { color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px; margin: 0; }
    .subtitle { color: #94a3b8; font-size: 14px; margin-top: 6px; }
    .badge { display: inline-block; background: #22c55e; color: #ffffff; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 9999px; margin-top: 10px; }
    .body { padding: 32px 28px; line-height: 1.6; font-size: 15px; }
    .credentials-box { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px 20px; margin: 24px 0; }
    .btn-container { text-align: center; margin: 30px 0; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(37,99,235,0.2); }
    .info-box { background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 16px; margin: 20px 0; font-size: 13.5px; color: #1e40af; border-radius: 4px; }
    .warning { background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #92400e; border-radius: 4px; }
    .footer { border-top: 1px solid #e2e8f0; padding: 20px 28px; font-size: 12px; color: #64748b; text-align: center; background: #f8fafc; }
    .link-alt { word-break: break-all; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="logo">TISNET</h1>
      <div class="subtitle">Plataforma de Soluciones Digitales</div>
      <div class="badge">Cuenta Activada</div>
    </div>
    <div class="body">
      <p>Hola, <strong>${safeName}</strong>${safeCompany ? ` (${safeCompany})` : ''}:</p>
      <p>Nos complace informarte que tu cuenta de cliente en <strong>TISNET</strong> ha sido creada y activada con éxito por nuestro equipo administrativo.</p>
      
      ${
        safeQuoteCode
          ? `<div class="info-box">
              <strong>Proyecto / Cotización vinculada:</strong> ${safeQuoteCode}
              ${input.solutionType ? `<br><strong>Tipo de Solución:</strong> ${escapeHtml(input.solutionType.replace(/_/g, ' '))}` : ''}
             </div>`
          : ''
      }

      <p>A continuación encontrarás tus credenciales oficiales de acceso a la plataforma:</p>

      <div class="credentials-box">
        <div style="margin-bottom: 8px;">
          <span style="color: #64748b; font-size: 13px;">Correo electrónico:</span><br>
          <strong style="font-size: 15px; color: #0f172a;">${safeEmail}</strong>
        </div>
        <div style="margin-top: 12px;">
          <span style="color: #64748b; font-size: 13px;">Contraseña temporal:</span><br>
          <code style="display: inline-block; margin-top: 4px; background: #ffffff; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; font-size: 15px; font-weight: bold; color: #1e293b; letter-spacing: 0.5px;">${safePassword}</code>
        </div>
      </div>

      <div class="btn-container">
        <a href="${safeLoginUrl}" class="btn" target="_blank" rel="noopener noreferrer">Iniciar Sesión en TISNET</a>
      </div>

      <div class="warning">
        🔒 <strong>Recomendación de seguridad:</strong> Por tu seguridad, te sugerimos cambiar tu contraseña temporal después de tu primer inicio de sesión desde el menú de perfil.
      </div>

      <p style="font-size: 13px; color: #64748b;">
        Si el botón superior no abre la página, ingresa directamente copiando este enlace en tu navegador:<br>
        <span class="link-alt">${escapeHtml(input.loginUrl)}</span>
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} TISNET · Soluciones Digitales. Todos los derechos reservados.<br>
      Si tienes preguntas o necesitas soporte, comunícate con nosotros respondiendo a este mensaje.
    </div>
  </div>
</body>
</html>`;

  const text = `¡Tu cuenta ha sido activada en TISNET!

Hola, ${input.recipientName || 'Cliente'}${input.company ? ` (${input.company})` : ''}:

Tu cuenta de cliente en TISNET ha sido creada y activada por nuestro equipo administrativo.
${input.quoteCode ? `Cotización / Proyecto vinculado: ${input.quoteCode}\n` : ''}
Tus credenciales de acceso son:
- Correo: ${input.recipientEmail}
- Contraseña: ${input.password}

Puedes iniciar sesión en: ${input.loginUrl}

Por seguridad, te sugerimos actualizar tu contraseña luego de ingresar.

Equipo TISNET · Soluciones Digitales`;

  return { subject, html, text };
}