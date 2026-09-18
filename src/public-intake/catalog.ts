import type { QuoteCatalog } from './contracts';
export const QUOTE_CATALOG_VERSION = 'SP-01-v2';
const extras = [
  { id: 'SEO_ADVANCED', name: 'SEO avanzado', priceMinor: 45000 },
  { id: 'CUSTOM_CMS', name: 'CMS personalizado', priceMinor: 70000 },
  { id: 'ADVANCED_ANALYTICS', name: 'Analytics avanzado', priceMinor: 35000 },
  { id: 'HOSTING_1Y', name: 'Hosting premium, 1 año', priceMinor: 28000 },
  { id: 'MULTILINGUAL', name: 'Sitio multidioma', priceMinor: 95000 },
  { id: 'MAINTENANCE_6M', name: 'Mantenimiento, 6 meses', priceMinor: 65000 },
  { id: 'LEAD_AUTOMATION', name: 'Automatización de leads', priceMinor: 78000 },
  { id: 'COMMERCIAL_CRM', name: 'CRM comercial', priceMinor: 92000 },
];
export const approvedQuoteCatalog: QuoteCatalog = {
  pricingStatus: 'AVAILABLE',
  solutions: [
    {
      id: 'LANDING_PAGE',
      name: 'Landing page',
      baseMinor: 85000,
      businessDays: 10,
      included: [
        'Presentación comercial y CTA',
        'Formulario de contacto',
        'Evidencia de confianza',
        'Adaptación a dispositivos',
      ],
      features: extras,
    },
    {
      id: 'CORPORATE_SITE',
      name: 'Página corporativa',
      baseMinor: 180000,
      businessDays: 20,
      included: [
        'Estructura de servicios',
        'Contenido de confianza',
        'Captación comercial',
        'Páginas institucionales',
      ],
      features: extras,
    },
    {
      id: 'ECOMMERCE',
      name: 'E-commerce',
      baseMinor: 320000,
      businessDays: 30,
      included: [
        'Carrito e integración de pago',
        'Inventario',
        'Administración de pedidos, clientes y catálogo',
      ],
      features: extras,
    },
    {
      id: 'PERSONAL_PORTFOLIO',
      name: 'Portafolio personal',
      baseMinor: 140000,
      businessDays: 14,
      included: [
        'Presentación profesional',
        'Galería de trabajos',
        'Servicios o habilidades',
        'Contacto',
      ],
      features: extras,
    },
    {
      id: 'WEB_APP',
      name: 'Aplicación web',
      baseMinor: 580000,
      businessDays: 42,
      included: [
        'Acceso y roles',
        'Dashboard',
        'Procesos internos',
        'Historial y reportes',
      ],
      features: extras,
    },
    {
      id: 'SAAS_PLATFORM',
      name: 'Plataforma SaaS',
      baseMinor: 760000,
      businessDays: 55,
      included: [
        'Activación inicial de clientes',
        'Permisos',
        'Estructura para cobros',
        'Métricas',
      ],
      features: extras,
    },
    {
      id: 'MOBILE_APP',
      name: 'Aplicación móvil · evaluación comercial',
      features: [],
    },
    {
      id: 'CUSTOM_SOFTWARE',
      name: 'Software a medida · evaluación comercial',
      features: [],
    },
  ],
};
