import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import fs from 'node:fs';
import path from 'node:path';

// Cargar .env.test si existe para aislar la base de datos de pruebas E2E
const envTestPath = path.resolve(__dirname, '.env.test');
if (fs.existsSync(envTestPath) && typeof (process as any).loadEnvFile === 'function') {
  (process as any).loadEnvFile(envTestPath);
}

// Si se define DATABASE_URL_TEST, priorizarla para los tests E2E
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: {
      NODE_ENV: 'test',
      ...(process.env.DATABASE_URL_TEST ? { DATABASE_URL: process.env.DATABASE_URL_TEST } : {}),
    },
  },
});
