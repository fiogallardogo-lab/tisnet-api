import { escapeHtml } from './escape-html';

export interface PasswordResetEmailInput {
  recipientEmail: string;
  recipientName: string;
  resetUrl: string;
  expiresInMinutes?: number;
}

export function renderPasswordResetEmail(input: PasswordResetEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const expiresIn = input.expiresInMinutes ?? 15;
  const safeName = escapeHtml(input.recipientName || 'Usuario');
  const safeUrl = input.resetUrl.replace(/"/g, '&quot;');
  const subject = 'Restablecimiento de contraseña — TISNET';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 28px; text-align: center; }
    .logo { color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; margin: 0; }
    .body { padding: 32px 28px; line-height: 1.6; font-size: 15px; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; }
    .warning { background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #92400e; border-radius: 4px; }
    .footer { border-top: 1px solid #e2e8f0; padding: 20px 28px; font-size: 12px; color: #64748b; text-align: center; }
    .link-alt { word-break: break-all; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="logo">TISNET</h1>
    </div>
    <div class="body">
      <p>Hola, <strong>${safeName}</strong>:</p>
      <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en la plataforma TISNET.</p>
      <p>Haz clic en el siguiente botón para definir tu nueva contraseña:</p>
      <div class="btn-container">
        <a href="${safeUrl}" class="btn" target="_blank" rel="noopener noreferrer">Restablecer mi contraseña</a>
      </div>
      <div class="warning">
        Este enlace expirará en <strong>${expiresIn} minutos</strong> y solo puede ser utilizado una vez.
      </div>
      <p style="font-size: 13px; color: #64748b;">
        Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:<br>
        <span class="link-alt">${escapeHtml(input.resetUrl)}</span>
      </p>
      <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
        Si no realizaste esta solicitud, puedes ignorar este mensaje de forma segura. Tu contraseña actual no sufrirá ningún cambio.
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} TISNET. Todos los derechos reservados.
    </div>
  </div>
</body>
</html>`;

  const text = `Restablecimiento de contraseña — TISNET

Hola, ${input.recipientName || 'Usuario'}:

Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en TISNET.
Para definir una nueva contraseña, ingresa al siguiente enlace (válido por ${expiresIn} minutos):

${input.resetUrl}

Si tú no realizaste esta solicitud, puedes ignorar este mensaje; tu contraseña permanecerá segura.

Equipo TISNET`;

  return { subject, html, text };
}
