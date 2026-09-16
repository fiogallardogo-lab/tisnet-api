import {
  QuoteCatalog,
  QuoteOptionDefinition,
  QuoteSolutionDefinition,
} from './quote-catalog';

/** Catálogo aprobado por PO para el flujo inicial de Quotes. */
export const QUOTES_CATALOG_V1_VERSION = 'quotes-catalog-v1';

export const QUOTES_SOLUTIONS_V1: QuoteSolutionDefinition[] = [
  { code: 'WEB_APP', name: 'Aplicación web', isActive: true },
  { code: 'MOBILE_APP', name: 'Aplicación móvil', isActive: true },
  { code: 'CUSTOM_SOFTWARE', name: 'Software a medida', isActive: true },
];

export const QUOTES_OPTIONS_V1: QuoteOptionDefinition[] = [
  {
    code: 'AUTHENTICATION',
    name: 'Autenticación y roles',
    solutionTypes: ['WEB_APP', 'MOBILE_APP', 'CUSTOM_SOFTWARE'],
    isActive: true,
    displayOrder: 1,
  },
  {
    code: 'ADMIN_PANEL',
    name: 'Panel administrativo',
    solutionTypes: ['WEB_APP', 'CUSTOM_SOFTWARE'],
    isActive: true,
    displayOrder: 2,
  },
  {
    code: 'REPORTS',
    name: 'Reportes y exportaciones',
    solutionTypes: ['WEB_APP', 'MOBILE_APP', 'CUSTOM_SOFTWARE'],
    isActive: true,
    displayOrder: 3,
  },
  {
    code: 'INTEGRATIONS',
    name: 'Integraciones con servicios externos',
    solutionTypes: ['WEB_APP', 'MOBILE_APP', 'CUSTOM_SOFTWARE'],
    isActive: true,
    displayOrder: 4,
  },
  {
    code: 'DEPLOYMENT',
    name: 'Despliegue y puesta en producción',
    solutionTypes: ['WEB_APP', 'MOBILE_APP', 'CUSTOM_SOFTWARE'],
    isActive: true,
    displayOrder: 5,
  },
];

export const quotesCatalogV1: QuoteCatalog = {
  findSolution: (code) =>
    QUOTES_SOLUTIONS_V1.find((solution) => solution.code === code),
  findOption: (code) =>
    QUOTES_OPTIONS_V1.find((option) => option.code === code),
};
