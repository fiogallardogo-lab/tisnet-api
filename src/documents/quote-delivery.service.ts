import { Inject, Injectable } from '@nestjs/common';

import {
    DOCUMENT_RENDERER,
    DocumentRenderer,
    QuoteDocumentData,
} from './document-renderer.interface';

import {
    STORAGE_PROVIDER,
    StorageProvider,
} from '../storage/storage-provider.interface';

import {
    NOTIFICATION_PROVIDER,
    NotificationProvider,
} from '../notifications/notification-provider.interface';

export interface DeliverQuoteInput {
    quote: QuoteDocumentData;
    recipient: string;
}

export interface DeliverQuoteResult {
    storageKey: string;
    documentUrl: string;
    messageId: string;
}

@Injectable()
export class QuoteDeliveryService {
    constructor(
        @Inject(DOCUMENT_RENDERER)
        private readonly renderer: DocumentRenderer,

        @Inject(STORAGE_PROVIDER)
        private readonly storage: StorageProvider,

        @Inject(NOTIFICATION_PROVIDER)
        private readonly notification: NotificationProvider,
    ) { }

    async deliver(
        input: DeliverQuoteInput,
    ): Promise<DeliverQuoteResult> {
        const document = await this.renderer.renderQuote(input.quote);

        const stored = await this.storage.save({
            key: document.filename,
            content: document.content,
            mimeType: document.mimeType,
            metadata: {
                quoteCode: input.quote.publicCode,
            },
        });

        const result = await this.notification.send({
            recipient: input.recipient,
            subject: `Cotización TISNET ${input.quote.publicCode}`,
            text: `Adjuntamos la cotización ${input.quote.publicCode}.`,
            attachments: [
                {
                    filename: document.filename,
                    mimeType: document.mimeType,
                    content: document.content,
                },
            ],
            metadata: {
                quoteCode: input.quote.publicCode,
                storageKey: stored.storageKey,
            },
        });

        return {
            storageKey: stored.storageKey,
            documentUrl: stored.url,
            messageId: result.messageId,
        };
    }
}