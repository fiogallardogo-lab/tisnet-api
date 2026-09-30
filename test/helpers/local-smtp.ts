import { createServer, type Server, type Socket } from 'node:net';
import { SmtpNotificationProvider } from '../../src/notifications/smtp-notification.provider';
import { FakeNotificationProvider } from '../../src/notifications/fake-notification.provider';
import type { SendNotificationInput } from '../../src/notifications/notification-provider.interface';
/** Local protocol-level SMTP inbox. Never connects to an external recipient/domain. */
export class LocalSmtp extends FakeNotificationProvider {
  readonly inbox: string[] = [];
  private server: Server;
  private sockets = new Set<Socket>();
  private smtp: SmtpNotificationProvider;
  private rejectMail = false;
  async start() {
    this.server = createServer((socket) => {
      this.sockets.add(socket);
      socket.on('close', () => this.sockets.delete(socket));
      socket.on('error', () => {});
      socket.write('220 localhost ESMTP test inbox\r\n');
      let buffer = '',
        data = false,
        lines: string[] = [];
      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        let end: number;
        while ((end = buffer.indexOf('\r\n')) >= 0) {
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (data) {
            if (line === '.') {
              data = false;
              this.inbox.push(lines.join('\r\n'));
              lines = [];
              socket.write('250 queued locally\r\n');
            } else lines.push(line.replace(/^\.\./, '.'));
            continue;
          }
          const command = line.split(' ')[0].toUpperCase();
          if (command === 'EHLO' || command === 'HELO')
            socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
          else if (command === 'AUTH') socket.write('235 authenticated\r\n');
          else if (command === 'MAIL')
            socket.write(
              this.rejectMail ? '550 rejected for test\r\n' : '250 OK\r\n',
            );
          else if (command === 'DATA') {
            data = true;
            socket.write('354 end with dot\r\n');
          } else if (command === 'QUIT') {
            socket.end('221 bye\r\n');
          } else socket.write('250 OK\r\n');
        }
      });
    });
    await new Promise<void>((resolve) =>
      this.server.listen(0, '127.0.0.1', resolve),
    );
    const port = (this.server.address() as { port: number }).port;
    this.smtp = new SmtpNotificationProvider({
      provider: 'smtp',
      smtpHost: '127.0.0.1',
      smtpPort: port,
      smtpSecure: false,
      smtpUser: 'local-test',
      smtpPass: 'local-test-only',
      mailFrom: 'noreply@example.test',
    });
    return this;
  }
  override simulateFailure(value: boolean) {
    this.rejectMail = value;
    super.simulateFailure(value);
  }
  override async send(input: SendNotificationInput) {
    const result = await this.smtp.send(input);
    await super.send(input);
    return result;
  }
  async close() {
    await this.smtp?.onModuleDestroy();
    for (const s of this.sockets) s.destroy();
    if (this.server)
      await new Promise<void>((resolve, reject) =>
        this.server.close((e) => (e ? reject(e) : resolve())),
      );
  }
}
