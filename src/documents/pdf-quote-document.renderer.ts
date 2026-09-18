import { Injectable } from '@nestjs/common';
import {
    PDFDocument,
    PDFFont,
    PDFPage,
    StandardFonts,
    rgb,
} from 'pdf-lib';

import {
    DocumentRenderError,
    DocumentRenderer,
    QuoteDocumentData,
    RenderedDocument,
} from './document-renderer.interface';

@Injectable()
export class PdfQuoteDocumentRenderer implements DocumentRenderer {
    async renderQuote(data: QuoteDocumentData): Promise<RenderedDocument> {
        try {
            const pdf = await PDFDocument.create();

            let page = pdf.addPage([595.28, 841.89]);

            const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
            const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

            let y = 790;

            const writeLine = (
                text: string,
                options?: {
                    bold?: boolean;
                    size?: number;
                    spacing?: number;
                },
            ) => {
                const size = options?.size ?? 11;
                const spacing = options?.spacing ?? 18;

                if (y < 60) {
                    page = pdf.addPage([595.28, 841.89]);
                    y = 790;
                }

                page.drawText(this.sanitize(text), {
                    x: 50,
                    y,
                    size,
                    font: options?.bold ? boldFont : regularFont,
                    color: rgb(0, 0, 0),
                });

                y -= spacing;
            };

            this.drawHeader(page, boldFont);

            y = 745;

            writeLine('COTIZACION COMERCIAL', {
                bold: true,
                size: 18,
                spacing: 30,
            });

            writeLine(`Codigo: ${data.publicCode}`, {
                bold: true,
            });

            writeLine(
                `Fecha: ${this.formatDate(data.createdAt)}`,
                { spacing: 26 },
            );

            writeLine('DATOS DEL CLIENTE', {
                bold: true,
                size: 13,
                spacing: 22,
            });

            writeLine(`Cliente: ${data.contactName}`);
            writeLine(`Correo: ${data.contactEmail}`, {
                spacing: 26,
            });

            writeLine('SOLUCION SOLICITADA', {
                bold: true,
                size: 13,
                spacing: 22,
            });

            writeLine(`Tipo de solucion: ${data.solutionType}`, {
                spacing: 22,
            });

            if (data.options.length > 0) {
                writeLine('Caracteristicas seleccionadas:', {
                    bold: true,
                });

                for (const option of data.options) {
                    writeLine(`- ${option.label}`);
                }

                y -= 8;
            }

            writeLine('DETALLE DE PRECIOS', {
                bold: true,
                size: 13,
                spacing: 24,
            });

            if (data.items.length === 0) {
                writeLine('Precio pendiente de definicion.');
            } else {
                for (const item of data.items) {
                    const amount = this.formatMoney(
                        item.amountMinor,
                        data.pricing.currency,
                    );

                    writeLine(`${item.label}: ${amount}`);
                }
            }

            y -= 8;

            writeLine(
                `TOTAL: ${this.formatNullableMoney(
                    data.pricing.totalMinor,
                    data.pricing.currency,
                )}`,
                {
                    bold: true,
                    size: 14,
                    spacing: 24,
                },
            );

            if (data.pricing.pricingVersion) {
                writeLine(
                    `Version de precios: ${data.pricing.pricingVersion}`,
                    {
                        size: 9,
                        spacing: 18,
                    },
                );
            }

            y -= 10;

            writeLine(
                'Documento generado por TISNET.',
                {
                    size: 9,
                },
            );

            const bytes = await pdf.save();

            return {
                filename: `quote-${data.publicCode}.pdf`,
                mimeType: 'application/pdf',
                content: Buffer.from(bytes),
            };
        } catch (error) {
            if (error instanceof DocumentRenderError) {
                throw error;
            }

            throw new DocumentRenderError(
                `No se pudo generar el PDF de la cotizacion: ${error instanceof Error ? error.message : 'unknown error'
                }`,
            );
        }
    }

    private drawHeader(page: PDFPage, font: PDFFont): void {
        page.drawText('TISNET', {
            x: 50,
            y: 800,
            size: 22,
            font,
            color: rgb(0.05, 0.05, 0.05),
        });

        page.drawLine({
            start: { x: 50, y: 780 },
            end: { x: 545, y: 780 },
            thickness: 1,
            color: rgb(0.7, 0.7, 0.7),
        });
    }

    private formatMoney(
        amountMinor: number,
        currency: string,
    ): string {
        return `${currency} ${(amountMinor / 100).toFixed(2)}`;
    }

    private formatNullableMoney(
        amountMinor: number | null,
        currency: string,
    ): string {
        if (amountMinor === null) {
            return 'Pendiente';
        }

        return this.formatMoney(amountMinor, currency);
    }

    private formatDate(date: Date): string {
        return date.toISOString().slice(0, 10);
    }

    private sanitize(value: string): string {
        return value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\x20-\x7E]/g, '');
    }
}