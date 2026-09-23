import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T> | StreamableFile
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T> | StreamableFile> {
    return next.handle().pipe(
      map((data) => {
        // Binary responses must reach Nest unchanged. Wrapping a
        // StreamableFile serializes its internals as JSON and corrupts
        // protected downloads such as applicant CVs and photos.
        if (data instanceof StreamableFile) {
          return data;
        }

        // Allow throwing custom structured response from services
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          'message' in data &&
          'data' in data
        ) {
          return data as Response<T>;
        }

        return {
          success: true,
          message: 'Operación realizada correctamente',
          data: data,
        };
      }),
    );
  }
}
