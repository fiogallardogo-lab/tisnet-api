import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
    success: boolean;
    message: string;
    data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
    intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
        return next.handle().pipe(
            map(data => {
                // Allow throwing custom structured response from services
                if (data && typeof data === 'object' && 'success' in data && 'message' in data && 'data' in data) {
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
