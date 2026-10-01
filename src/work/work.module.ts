import { PassportModule } from '@nestjs/passport';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { WorkController } from './work.controller';
import { WorkService } from './work.service';
import { PrivateFilesService } from './private-files.service';
import { PrivateFilesController } from './private-files.controller';
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
    StorageModule,
  ],
  controllers: [WorkController, PrivateFilesController],
  providers: [WorkService, PrivateFilesService],
  exports: [WorkService],
})
export class WorkModule {}
