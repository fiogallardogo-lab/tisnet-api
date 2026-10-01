import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
export function ApiWorkErrors() {
  return applyDecorators(
    ...[400, 401, 403, 404, 409, 413, 429, 500, 503].map((status) =>
      ApiResponse({
        status,
        description: (
          {
            400: 'DTO inválido',
            401: 'JWT ausente, vencido o revocado',
            403: 'Rol o membresía no autorizados',
            404: 'Recurso inexistente o ajeno',
            409: 'Estado o restricción de negocio',
            413: 'Archivo demasiado grande',
            429: 'Límite de solicitudes',
            500: 'Error interno',
            503: 'Dependencia no disponible',
          } as Record<number, string>
        )[status],
        schema: {
          type: 'object',
          required: ['success', 'message', 'error'],
          properties: {
            success: { type: 'boolean', enum: [false] },
            message: {
              oneOf: [
                { type: 'string' },
                { type: 'array', items: { type: 'string' } },
              ],
            },
            error: { type: 'string' },
          },
        },
      }),
    ),
  );
}
