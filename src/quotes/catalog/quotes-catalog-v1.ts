import {
  QuoteCatalog,
  QuoteOptionDefinition,
  QuoteSolutionDefinition,
} from './quote-catalog';

/** Versión del catálogo activo en la API de Quotes */
export const QUOTES_CATALOG_V1_VERSION = 'quotes-catalog-sp01-v2';

export const SP01_V2_SOLUTION_CODES = [
  'LANDING_PAGE',
  'CORPORATE_SITE',
  'ECOMMERCE',
  'PERSONAL_PORTFOLIO',
  'WEB_APP',
  'SAAS_PLATFORM',
] as const;

export const UNPRICED_SOLUTION_CODES = [
  'MOBILE_APP',
  'CUSTOM_SOFTWARE',
] as const;

export const ALL_SOLUTION_CODES = [
  ...SP01_V2_SOLUTION_CODES,
  ...UNPRICED_SOLUTION_CODES,
];

export const QUOTES_SOLUTIONS_V1: QuoteSolutionDefinition[] = [
  { code: 'LANDING_PAGE', name: 'Landing page', isActive: true },
  { code: 'CORPORATE_SITE', name: 'Sitio web corporativo', isActive: true },
  { code: 'ECOMMERCE', name: 'Tienda virtual (E-commerce)', isActive: true },
  { code: 'PERSONAL_PORTFOLIO', name: 'Portafolio profesional', isActive: true },
  { code: 'WEB_APP', name: 'Aplicación web', isActive: true },
  { code: 'SAAS_PLATFORM', name: 'Plataforma SaaS', isActive: true },
  { code: 'MOBILE_APP', name: 'Aplicación móvil', isActive: true },
  { code: 'CUSTOM_SOFTWARE', name: 'Software a medida', isActive: true },
];

export const QUOTES_OPTIONS_V1: QuoteOptionDefinition[] = [
  // Extras SP-01-v2
  {
    code: 'SEO_ADVANCED',
    name: 'SEO avanzado y posicionamiento',
    solutionTypes: ALL_SOLUTION_CODES,
    isActive: true,
    displayOrder: 1,
  },
  {
    code: 'CUSTOM_CMS',
    name: 'Panel autoadministrable a medida (CMS)',
    solutionTypes: ALL_SOLUTION_CODES,
    isActive: true,
    displayOrder: 2,
  },
  {
    code: 'ADVANCED_ANALYTICS',
    name: 'Analítica avanzada y eventos',
    solutionTypes: ALL_SOLUTION_CODES,
    isActive: true,
    displayOrder: 3,
  },
  {
    code: 'HOSTING_1Y',
    name: 'Alojamiento cloud y dominio por 1 año',
    solutionTypes: ALL_SOLUTION_CODES,
    isActive: true,
    displayOrder: 4,
  },
  {
    code: 'MULTILINGUAL',
    name: 'Soporte multiidioma',
    solutionTypes: ALL_SOLUTION_CODES,
    isActive: true,
    displayOrder: 5,
  },
  {
    code: 'MAINTENANCE_6M',
    name: 'Mantenimiento y soporte técnico por 6 meses',
    solutionTypes: ALL_SOLUTION_CODES,
    isActive: true,
    displayOrder: 6,
  },
  {
    code: 'LEAD_AUTOMATION',
    name: 'Automatización de captación de leads',
    solutionTypes: ALL_SOLUTION_CODES,
    isActive: true,
    displayOrder: 7,
  },
  {
    code: 'COMMERCIAL_CRM',
    name: 'Integración con CRM comercial',
    solutionTypes: ALL_SOLUTION_CODES,
    isActive: true,
    displayOrder: 8,
  },

  // Características previas v1 (reconocidas pero sin regla tarifaria SP-01-v2)
  {
    code: 'AUTHENTICATION',
    name: 'Autenticación y roles',
    solutionTypes: ['WEB_APP', 'MOBILE_APP', 'CUSTOM_SOFTWARE'],
    isActive: true,
    displayOrder: 9,
  },
  {
    code: 'ADMIN_PANEL',
    name: 'Panel administrativo',
    solutionTypes: ['WEB_APP', 'CUSTOM_SOFTWARE'],
    isActive: true,
    displayOrder: 10,
  },
  {
    code: 'REPORTS',
    name: 'Reportes y exportaciones',
    solutionTypes: ['WEB_APP', 'MOBILE_APP', 'CUSTOM_SOFTWARE'],
    isActive: true,
    displayOrder: 11,
  },
  {
    code: 'INTEGRATIONS',
    name: 'Integraciones con servicios externos',
    solutionTypes: ['WEB_APP', 'MOBILE_APP', 'CUSTOM_SOFTWARE'],
    isActive: true,
    displayOrder: 12,
  },
  {
    code: 'DEPLOYMENT',
    name: 'Despliegue y puesta en producción',
    solutionTypes: ['WEB_APP', 'MOBILE_APP', 'CUSTOM_SOFTWARE'],
    isActive: true,
    displayOrder: 13,
  },
];

export const quotesCatalogV1: QuoteCatalog = {
  findSolution: (code) =>
    QUOTES_SOLUTIONS_V1.find((solution) => solution.code === code),
  findOption: (code) =>
    QUOTES_OPTIONS_V1.find((option) => option.code === code),
};
