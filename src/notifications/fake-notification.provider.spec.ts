import { beforeEach, describe, expect, it } from 'vitest';

import { FakeNotificationProvider } from './fake-notification.provider';
import {
    NotificationDeliveryError,
    SendNotificationInput,
} from './notification-provider.interface';

describe('FakeNotificationProvider', () => {
    let provider: FakeNotificationProvider;

    const notification: SendNotificationInput = {
        recipient: 'cliente@tisnet.test',
        subject: 'Cotización TISNET Q-TEST1234',
        text: 'Adjuntamos su cotización.',
        html: '<p>Adjuntamos su cotización.</p>',
        attachments: [
            {
                filename: 'quote-Q-TEST1234.pdf',
                mimeType: 'application/pdf',
                content: Buffer.from('fake-pdf-content'),
            },
        ],
        metadata: {
            quoteCode: 'Q-TEST1234',
        },
    };

    beforeEach(() => {
        provider = new FakeNotificationProvider();
    });

    it('envía una notificación simulada correctamente', async () => {
        const result = await provider.send(notification);

        expect(result.messageId).toBe('fake-message-1');
        expect(result.recipient).toBe('cliente@tisnet.test');
        expect(result.sentAt).toBeInstanceOf(Date);

        expect(provider.sentNotifications).toHaveLength(1);
    });

    it('registra la última notificación enviada', async () => {
        await provider.send(notification);

        const lastNotification = provider.getLastNotification();

        expect(lastNotification).toBeDefined();
        expect(lastNotification?.recipient).toBe('cliente@tisnet.test');
        expect(lastNotification?.subject).toBe(
            'Cotización TISNET Q-TEST1234',
        );
    });

    it('permite inspeccionar el historial de notificaciones', async () => {
        await provider.send(notification);

        await provider.send({
            ...notification,
            recipient: 'segundo@tisnet.test',
        });

        const notifications = provider.getSentNotifications();

        expect(notifications).toHaveLength(2);
        expect(notifications[0].recipient).toBe('cliente@tisnet.test');
        expect(notifications[1].recipient).toBe('segundo@tisnet.test');
    });

    it('genera messageId determinista e incremental', async () => {
        const first = await provider.send(notification);
        const second = await provider.send(notification);

        expect(first.messageId).toBe('fake-message-1');
        expect(second.messageId).toBe('fake-message-2');
    });

    it('almacena correctamente los archivos adjuntos', async () => {
        await provider.send(notification);

        const stored = provider.getLastNotification();

        expect(stored?.attachments).toHaveLength(1);
        expect(stored?.attachments?.[0].filename).toBe(
            'quote-Q-TEST1234.pdf',
        );
        expect(stored?.attachments?.[0].mimeType).toBe('application/pdf');

        expect(
            stored?.attachments?.[0].content.toString('utf8'),
        ).toBe('fake-pdf-content');
    });

    it('no comparte la misma referencia de Buffer del adjunto', async () => {
        const originalBuffer = Buffer.from('contenido-original');

        await provider.send({
            ...notification,
            attachments: [
                {
                    filename: 'test.pdf',
                    mimeType: 'application/pdf',
                    content: originalBuffer,
                },
            ],
        });

        const stored = provider.getLastNotification();

        expect(stored?.attachments?.[0].content).not.toBe(originalBuffer);
        expect(stored?.attachments?.[0].content.equals(originalBuffer)).toBe(
            true,
        );
    });

    it('permite simular un fallo del proveedor', async () => {
        provider.simulateFailure(
            true,
            new NotificationDeliveryError('email provider unavailable'),
        );

        await expect(provider.send(notification)).rejects.toThrow(
            'email provider unavailable',
        );

        expect(provider.sentNotifications).toHaveLength(0);
    });

    it('clear reinicia historial, secuencia y estado de error', async () => {
        await provider.send(notification);

        provider.simulateFailure(true);

        provider.clear();

        expect(provider.getSentNotifications()).toHaveLength(0);
        expect(provider.getLastNotification()).toBeUndefined();

        const result = await provider.send(notification);

        expect(result.messageId).toBe('fake-message-1');
    });
});