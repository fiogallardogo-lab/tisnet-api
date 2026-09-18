import { beforeEach, describe, expect, it } from 'vitest';

import {
    DocumentRenderError,
    QuoteDocumentData,
} from './document-renderer.interface';
import { FakeDocumentRenderer } from './fake-document-renderer';
import { QuoteDeliveryService } from './quote-delivery.service';

import { FakeNotificationProvider } from '../notifications/fake-notification.provider';
import { NotificationDeliveryError } from '../notifications/notification-provider.interface';
import { InMemoryStorageProvider } from '../storage/in-memory-storage.provider';
import { StorageProviderError } from '../storage/storage-provider.interface';

describe('QuoteDeliveryService', () => {
    let renderer: FakeDocumentRenderer;
    let storage: InMemoryStorageProvider;
    let notification: FakeNotificationProvider;
    let service: QuoteDeliveryService;

    const quote: QuoteDocumentData = {
        publicCode: 'Q-DELIVERY01',
        contactName: 'Cliente Demo',
        contactEmail: 'cliente@tisnet.test',
        solutionType: 'ECOMMERCE',
        options: [
            {
                code: 'SEO_ADVANCED',
                label: 'SEO avanzado',
            },
        ],
        items: [
            {
                code: 'BASE',
                label: 'E-commerce',
                amountMinor: 320000,
            },
            {
                code: 'SEO_ADVANCED',
                label: 'SEO avanzado',
                amountMinor: 45000,
            },
        ],
        pricing: {
            currency: 'PEN',
            pricingVersion: 'SP-01-v2',
            totalMinor: 365000,
        },
        createdAt: new Date('2026-09-18T15:00:00.000Z'),
    };

    beforeEach(() => {
        renderer = new FakeDocumentRenderer();
        storage = new InMemoryStorageProvider();
        notification = new FakeNotificationProvider();

        service = new QuoteDeliveryService(
            renderer,
            storage,
            notification,
        );
    });

    it('renderiza, almacena y envía la cotización correctamente', async () => {
        const result = await service.deliver({
            quote,
            recipient: quote.contactEmail,
        });

        expect(result.storageKey).toBe('quote-Q-DELIVERY01.pdf');
        expect(result.documentUrl).toBe(
            'memory://quote-Q-DELIVERY01.pdf',
        );
        expect(result.messageId).toBe('fake-message-1');

        expect(renderer.renderCalls).toHaveLength(1);
        expect(storage.count()).toBe(1);
        expect(notification.getSentNotifications()).toHaveLength(1);
    });

    it('almacena metadata con el código de cotización', async () => {
        const result = await service.deliver({
            quote,
            recipient: quote.contactEmail,
        });

        const stored = await storage.get(result.storageKey);

        expect(stored).not.toBeNull();
        expect(stored?.metadata).toEqual({
            quoteCode: 'Q-DELIVERY01',
        });
    });

    it('envía el documento generado como archivo adjunto', async () => {
        await service.deliver({
            quote,
            recipient: quote.contactEmail,
        });

        const sent = notification.getLastNotification();

        expect(sent).toBeDefined();
        expect(sent?.recipient).toBe('cliente@tisnet.test');
        expect(sent?.subject).toBe(
            'Cotización TISNET Q-DELIVERY01',
        );

        expect(sent?.attachments).toHaveLength(1);
        expect(sent?.attachments?.[0].filename).toBe(
            'quote-Q-DELIVERY01.pdf',
        );
        expect(sent?.attachments?.[0].mimeType).toBe(
            'application/pdf',
        );
    });

    it('no continúa con storage ni notification si falla el renderer', async () => {
        renderer.simulateFailure(
            true,
            new DocumentRenderError('renderer failed'),
        );

        await expect(
            service.deliver({
                quote,
                recipient: quote.contactEmail,
            }),
        ).rejects.toThrow('renderer failed');

        expect(storage.count()).toBe(0);
        expect(notification.getSentNotifications()).toHaveLength(0);
    });

    it('no envía notificación si falla el almacenamiento', async () => {
        storage.simulateFailure(
            true,
            new StorageProviderError('storage failed'),
        );

        await expect(
            service.deliver({
                quote,
                recipient: quote.contactEmail,
            }),
        ).rejects.toThrow('storage failed');

        expect(notification.getSentNotifications()).toHaveLength(0);
    });

    it('propaga el error si falla el proveedor de notificaciones', async () => {
        notification.simulateFailure(
            true,
            new NotificationDeliveryError('notification failed'),
        );

        await expect(
            service.deliver({
                quote,
                recipient: quote.contactEmail,
            }),
        ).rejects.toThrow('notification failed');

        expect(storage.count()).toBe(1);
        expect(notification.getSentNotifications()).toHaveLength(0);
    });

    it('permite múltiples entregas independientes', async () => {
        const first = await service.deliver({
            quote,
            recipient: quote.contactEmail,
        });

        const second = await service.deliver({
            quote: {
                ...quote,
                publicCode: 'Q-DELIVERY02',
            },
            recipient: 'segundo@tisnet.test',
        });

        expect(first.messageId).toBe('fake-message-1');
        expect(second.messageId).toBe('fake-message-2');

        expect(storage.count()).toBe(2);
        expect(notification.getSentNotifications()).toHaveLength(2);
    });
});