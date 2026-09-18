import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';

import { QuoteDocumentData } from './document-renderer.interface';
import { PdfQuoteDocumentRenderer } from './pdf-quote-document.renderer';

describe('PdfQuoteDocumentRenderer', () => {
    const renderer = new PdfQuoteDocumentRenderer();

    const quoteData: QuoteDocumentData = {
        publicCode: 'Q-PDF12345',
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
        createdAt: new Date('2026-09-18T15:00:00.000Z'),
    };

    it('genera un PDF real y válido', async () => {
        const result = await renderer.renderQuote(quoteData);

        expect(result.filename).toBe('quote-Q-PDF12345.pdf');
        expect(result.mimeType).toBe('application/pdf');
        expect(Buffer.isBuffer(result.content)).toBe(true);
        expect(result.content.byteLength).toBeGreaterThan(0);

        const signature = result.content.subarray(0, 5).toString('ascii');

        expect(signature).toBe('%PDF-');
    });

    it('genera un documento que puede volver a ser leído por pdf-lib', async () => {
        const result = await renderer.renderQuote(quoteData);

        const document = await PDFDocument.load(result.content);

        expect(document.getPageCount()).toBeGreaterThanOrEqual(1);
    });

    it('genera resultados independientes en llamadas sucesivas', async () => {
        const first = await renderer.renderQuote(quoteData);
        const second = await renderer.renderQuote(quoteData);

        expect(first.content).not.toBe(second.content);

        const firstDocument = await PDFDocument.load(first.content);
        const secondDocument = await PDFDocument.load(second.content);

        expect(firstDocument.getPageCount()).toBe(
            secondDocument.getPageCount(),
        );
    });

    it('genera un PDF aunque la cotización no tenga opciones', async () => {
        const result = await renderer.renderQuote({
            ...quoteData,
            options: [],
        });

        expect(result.mimeType).toBe('application/pdf');

        const document = await PDFDocument.load(result.content);

        expect(document.getPageCount()).toBeGreaterThanOrEqual(1);
    });

    it('genera un PDF aunque no existan items de precio', async () => {
        const result = await renderer.renderQuote({
            ...quoteData,
            items: [],
            pricing: {
                currency: 'PEN',
                pricingVersion: null,
                totalMinor: null,
            },
        });

        expect(result.mimeType).toBe('application/pdf');

        const document = await PDFDocument.load(result.content);

        expect(document.getPageCount()).toBeGreaterThanOrEqual(1);
    });

    it('crea páginas adicionales cuando existe una gran cantidad de items', async () => {
        const items = Array.from({ length: 80 }, (_, index) => ({
            code: `ITEM-${index + 1}`,
            label: `Servicio adicional ${index + 1}`,
            amountMinor: 1000,
        }));

        const result = await renderer.renderQuote({
            ...quoteData,
            items,
            pricing: {
                ...quoteData.pricing,
                totalMinor: 80000,
            },
        });

        const document = await PDFDocument.load(result.content);

        expect(document.getPageCount()).toBeGreaterThan(1);
    });
});