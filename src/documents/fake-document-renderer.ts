import { Injectable } from '@nestjs/common';

import {
    DocumentRenderError,
    DocumentRenderer,
    QuoteDocumentData,
    RenderedDocument,
} from './document-renderer.interface';

@Injectable()
export class FakeDocumentRenderer implements DocumentRenderer {
    readonly renderCalls: QuoteDocumentData[] = [];

    private shouldFail = false;
    private failureError: Error | null = null;

    async renderQuote(data: QuoteDocumentData): Promise<RenderedDocument> {
        if (this.shouldFail) {
            throw (
                this.failureError ??
                new DocumentRenderError('Simulated document render failure')
            );
        }

        this.renderCalls.push(structuredClone(data));

        const content = Buffer.from(
            [
                'TISNET QUOTE',
                `CODE=${data.publicCode}`,
                `CONTACT=${data.contactName}`,
                `EMAIL=${data.contactEmail}`,
                `SOLUTION=${data.solutionType}`,
                `CURRENCY=${data.pricing.currency}`,
                `PRICING_VERSION=${data.pricing.pricingVersion ?? ''}`,
                `TOTAL_MINOR=${data.pricing.totalMinor ?? ''}`,
            ].join('\n'),
            'utf8',
        );

        return {
            filename: `quote-${data.publicCode}.pdf`,
            mimeType: 'application/pdf',
            content,
        };
    }

    getLastCall(): QuoteDocumentData | undefined {
        return this.renderCalls.at(-1);
    }

    simulateFailure(shouldFail: boolean, error?: Error): void {
        this.shouldFail = shouldFail;
        this.failureError = shouldFail
            ? (error ?? new DocumentRenderError('Simulated document render failure'))
            : null;
    }

    clear(): void {
        this.renderCalls.length = 0;
        this.shouldFail = false;
        this.failureError = null;
    }
}