import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
export function ApiWorkResponse(type?: Function, status = 200) {
  return applyDecorators(
    ...(type ? [ApiExtraModels(type)] : []),
    ApiResponse({
      status,
      schema: {
        type: 'object',
        required: ['success', 'message', 'data'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          message: { type: 'string' },
          data: type
            ? { $ref: getSchemaPath(type) }
            : { type: 'object', nullable: true },
        },
      },
    }),
  );
}
