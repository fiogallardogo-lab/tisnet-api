export const DOCUMENT_RENDERER = Symbol('DOCUMENT_RENDERER');

export interface QuoteDocumentOption {
    code: string;
    label: string;
}

export interface QuoteDocumentItem {
    code: string;
    label: string;
    amountMinor: number;
}

export interface QuoteDocumentPricing {
    currency: string;
    pricingVersion: string | null;
    totalMinor: number | null;
}

export interface QuoteDocumentData {
    publicCode: string;
    contactName: string;
    contactEmail: string;
    solutionType: string;
    options: QuoteDocumentOption[];
    items: QuoteDocumentItem[];
    pricing: QuoteDocumentPricing;
    createdAt: Date;
}

export interface RenderedDocument {
    filename: string;
    mimeType: string;
    content: Buffer;
}

export interface DocumentRenderer {
    renderQuote(data: QuoteDocumentData): Promise<RenderedDocument>;
}

export class DocumentRenderError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DocumentRenderError';
    }
}