import { Global, Module } from '@nestjs/common';
import { SignedUrlService } from './signed-url.service';

@Global()
@Module({
  providers: [SignedUrlService],
  exports: [SignedUrlService],
})
export class SignedUrlModule {}
