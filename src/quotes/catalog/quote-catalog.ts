export const QUOTE_CATALOG = Symbol('QUOTE_CATALOG');

export interface QuoteSolutionDefinition {
  code: string;
  name: string;
  isActive: boolean;
}

export interface QuoteOptionDefinition {
  code: string;
  name: string;
  solutionTypes: string[];
  isActive: boolean;
  displayOrder: number;
}

/**
 * Puerto para el catálogo aprobado de soluciones y características.
 * No se incluye una implementación productiva hasta recibir sus valores.
 */
export interface QuoteCatalog {
  findSolution(code: string): QuoteSolutionDefinition | undefined;
  findOption(code: string): QuoteOptionDefinition | undefined;
}
