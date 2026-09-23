import { CallHandler, ExecutionContext, StreamableFile } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  it('should be defined', () => {
    expect(new TransformInterceptor()).toBeDefined();
  });

  it('passes binary StreamableFile responses through without a JSON envelope', async () => {
    const file = new StreamableFile(Buffer.from('%PDF-test'));
    const handler = { handle: () => of(file) } as CallHandler;

    const result = await firstValueFrom(
      new TransformInterceptor().intercept({} as ExecutionContext, handler),
    );

    expect(result).toBe(file);
  });
});
