import { beforeEach, describe, expect, it } from 'vitest';

import {
    DocumentRenderError,
    QuoteDocumentData,
} from './document-renderer.interface';
import { FakeDocumentRenderer } from './fake-document-renderer';

describe('FakeDocumentRenderer', () => {
    let renderer: FakeDocumentRenderer;

    const quoteData: QuoteDocumentData = {
        publicCode: 'Q-TEST1234',
        contactName: 'Cliente Demo',
        contactEmail: 'cliente@tisnet.test',
        solutionType: 'ECOMMERCE',
        options: [
            {
                code: 'SEO_ADVANCED',
                label: 'SEO avanzado',
            },
            {
                code: 'ADVANCED_ANALYTICS',
                label: 'Analytics avanzado',
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
            {
                code: 'ADVANCED_ANALYTICS',
                label: 'Analytics avanzado',
                amountMinor: 35000,
            },
        ],
        pricing: {
            currency: 'PEN',
            pricingVersion: 'SP-01-v2',
            totalMinor: 400000,
        },
        createdAt: new Date('2026-09-18T10:00:00.000Z'),
    };

    beforeEach(() => {
        renderer = new FakeDocumentRenderer();
    });

    it('genera un documento determinista para una cotización', async () => {
        const document = await renderer.renderQuote(quoteData);

        expect(document.filename).toBe('quote-Q-TEST1234.pdf');
        expect(document.mimeType).toBe('application/pdf');

        const text = document.content.toString('utf8');

        expect(text).toContain('TISNET QUOTE');
        expect(text).toContain('CODE=Q-TEST1234');
        expect(text).toContain('CONTACT=Cliente Demo');
        expect(text).toContain('EMAIL=cliente@tisnet.test');
        expect(text).toContain('SOLUTION=ECOMMERCE');
        expect(text).toContain('CURRENCY=PEN');
        expect(text).toContain('PRICING_VERSION=SP-01-v2');
        expect(text).toContain('TOTAL_MINOR=400000');
    });

    it('registra las llamadas realizadas al renderer', async () => {
        await renderer.renderQuote(quoteData);

        expect(renderer.renderCalls).toHaveLength(1);
        expect(renderer.getLastCall()).toEqual(quoteData);
    });

    it('genera el mismo contenido para la misma entrada', async () => {
        const first = await renderer.renderQuote(quoteData);
        const second = await renderer.renderQuote(quoteData);

        expect(first.content.equals(second.content)).toBe(true);
    });

    it('permite simular un error de renderizado', async () => {
        renderer.simulateFailure(
            true,
            new DocumentRenderError('renderer unavailable'),
        );

        await expect(renderer.renderQuote(quoteData)).rejects.toThrow(
            'renderer unavailable',
        );
    });

    it('clear reinicia llamadas y estado de error', async () => {
        await renderer.renderQuote(quoteData);

        renderer.simulateFailure(true);
        renderer.clear();

        expect(renderer.renderCalls).toHaveLength(0);
        expect(renderer.getLastCall()).toBeUndefined();

        await expect(renderer.renderQuote(quoteData)).resolves.toBeDefined();
    });
});