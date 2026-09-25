import { renderPasswordResetEmail } from './password-reset-notification';

describe('renderPasswordResetEmail', () => {
  it('should render subject, html and plaintext correctly', () => {
    const result = renderPasswordResetEmail({
      recipientEmail: 'user@example.com',
      recipientName: 'Carlos Gómez',
      resetUrl: 'https://tisnet.pe/auth/reset-password?token=secret123',
      expiresInMinutes: 20,
    });

    expect(result.subject).toContain('Restablecimiento de contraseña');
    expect(result.html).toContain('Carlos Gómez');
    expect(result.html).toContain('https://tisnet.pe/auth/reset-password?token=secret123');
    expect(result.html).toContain('20 minutos');
    expect(result.text).toContain('https://tisnet.pe/auth/reset-password?token=secret123');
    expect(result.text).toContain('20 minutos');
  });

  it('should escape HTML characters in name and url to prevent XSS injection', () => {
    const result = renderPasswordResetEmail({
      recipientEmail: 'hacker@example.com',
      recipientName: '<script>alert("xss")</script>',
      resetUrl: 'https://tisnet.pe/reset?a=1&b=2" onclick="alert(1)',
    });

    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
    expect(result.html).not.toContain('" onclick="');
  });
});
