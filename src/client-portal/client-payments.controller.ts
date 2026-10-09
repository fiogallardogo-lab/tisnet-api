import {
  Controller,
  Body,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsString, Matches, MaxLength } from 'class-validator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClientPaymentsService } from './client-payments.service';

class CreateCardChargeDto {
  @IsString()
  @Matches(/^tkn_(test|live)_[a-zA-Z0-9]+$/)
  @MaxLength(200)
  tokenId!: string;
}

@ApiTags('Client portal')
@ApiBearerAuth()
@Controller('client/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CLIENT')
export class ClientPaymentsController {
  constructor(private readonly service: ClientPaymentsService) {}

  @Get()
  listMine(@Request() request: { user: { id: number } }) {
    return this.service.listMine(request.user);
  }

  @Post(':installmentId/charge')
  createCharge(
    @Request() request: { user: { id: number; email: string } },
    @Param('installmentId', ParseIntPipe) installmentId: number,
    @Body() body: CreateCardChargeDto,
  ) {
    return this.service.createCharge(installmentId, request.user, body.tokenId);
  }

  @Post(':installmentId/checkout')
  createCheckout(
    @Request() request: { user: { id: number; email: string } },
    @Param('installmentId', ParseIntPipe) installmentId: number,
  ) {
    return this.service.createCheckout(installmentId, request.user);
  }

  @Post(':installmentId/manual-submissions')
  @UseInterceptors(FileInterceptor('receipt', { limits: { fileSize: 5 * 1024 * 1024 } }))
  submitManualPayment(
    @Request() request: { user: { id: number; email: string } },
    @Param('installmentId', ParseIntPipe) installmentId: number,
    @UploadedFile() receipt: { originalname: string; mimetype: string; size: number } | undefined,
  ) {
    if (!receipt) {
      return { success: false, message: 'Adjunta un comprobante para continuar.' };
    }
    return {
      success: true,
      data: {
        id: `${request.user.id}-${installmentId}-${Date.now()}`,
        installmentId,
        status: 'SUBMITTED',
        fileName: receipt.originalname,
        mimeType: receipt.mimetype,
        size: receipt.size,
      },
    };
  }
}
