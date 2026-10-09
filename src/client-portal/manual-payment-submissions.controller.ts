import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ManualPaymentSubmissionsService,
  type ManualReceiptUpload,
} from './manual-payment-submissions.service';

class CreateManualPaymentSubmissionDto {
  @IsString()
  @MaxLength(100)
  operationNumber!: string;

  @IsIn(['BANK_TRANSFER', 'YAPE', 'PLIN'])
  paymentMethod!: string;

  @IsString()
  @MaxLength(40)
  paidAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

class ReviewManualPaymentSubmissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

type AuthenticatedRequest = { user: { id: number } };

@ApiTags('Client portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ManualPaymentSubmissionsController {
  constructor(private readonly service: ManualPaymentSubmissionsService) {}

  @Post('client/payments/:installmentId/manual-submissions')
  @Roles('CLIENT')
  @UseInterceptors(
    FileInterceptor('receipt', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  submit(
    @Param('installmentId', ParseIntPipe) installmentId: number,
    @Request() request: AuthenticatedRequest,
    @Body() body: CreateManualPaymentSubmissionDto,
    @UploadedFile() file?: ManualReceiptUpload,
  ) {
    return this.service.submit(installmentId, request.user, body, file);
  }

  @Get('admin/manual-payment-submissions')
  @Roles('ADMIN', 'SUPER_ADMIN')
  list() {
    return this.service.listPending();
  }

  @Get('admin/manual-payment-submissions/:id/receipt')
  @Roles('ADMIN', 'SUPER_ADMIN')
  receipt(@Param('id', ParseIntPipe) id: number) {
    return this.service.receipt(id);
  }

  @Post('admin/manual-payment-submissions/:id/:action')
  @Roles('ADMIN', 'SUPER_ADMIN')
  review(
    @Param('id', ParseIntPipe) id: number,
    @Param('action') action: string,
    @Request() request: AuthenticatedRequest,
    @Body() body: ReviewManualPaymentSubmissionDto,
  ) {
    if (action !== 'approve' && action !== 'reject')
      throw new BadRequestException('Acción de revisión no válida.');
    return this.service.review(id, request.user.id, action, body.notes);
  }
}
