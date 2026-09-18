import {
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CreateQuoteDto, TeamApplicationDto } from './intake.dto';
import { IntakeService } from './intake.service';
import type { IntakeFile } from './intake.service';
@Controller('public')
export class IntakeController {
  constructor(private readonly service: IntakeService) {}
  @Post('quotes')
  quote(@Body() body: CreateQuoteDto) {
    return this.service.createQuote(body);
  }
  @Post('team-applications')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'cv', maxCount: 1 },
        { name: 'photo', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 5 * 1024 * 1024,
          files: 2,
          fields: 14,
          fieldSize: 2048,
          parts: 16,
        },
      },
    ),
  )
  apply(
    @Body() body: TeamApplicationDto,
    @UploadedFiles() files: { cv?: IntakeFile[]; photo?: IntakeFile[] },
  ) {
    return this.service.apply(body, files ?? {});
  }
}
