import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';

import { DOCUMENT_RENDERER } from './document-renderer.interface';
import { PdfQuoteDocumentRenderer } from './pdf-quote-document.renderer';
import { QuoteDeliveryService } from './quote-delivery.service';

@Module({
    imports: [
        StorageModule,
        NotificationsModule,
    ],
    providers: [
        {
            provide: DOCUMENT_RENDERER,
            useClass: PdfQuoteDocumentRenderer,
        },
        QuoteDeliveryService,
    ],
    exports: [
        DOCUMENT_RENDERER,
        QuoteDeliveryService,
    ],
})
export class DocumentsModule { }