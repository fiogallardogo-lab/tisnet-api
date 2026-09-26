import { Test } from '@nestjs/testing';
import {
  getOptionsToken,
  type ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { AppModule } from '../../src/app.module';

// Only the functional E2E context opts out of rate limiting. JWT, RBAC and all
// other guards keep their normal providers. Do not import this helper in src/.
export function createAppTestModule() {
  const options: ThrottlerModuleOptions = {
    skipIf: () => true,
    throttlers: ['default', 'auth', 'public', 'webhook'].map((name) => ({
      name,
      ttl: 60000,
      limit: 120,
    })),
  };
  return Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(getOptionsToken())
    .useValue(options);
}
