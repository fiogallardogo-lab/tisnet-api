import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CreatePublicQuoteDto } from './dto/create-public-quote.dto';
import { CreatePublicQuoteResponseDto } from './dto/public-quote-response.dto';
import { RejectUnknownQuoteFieldsInterceptor } from './interceptors/reject-unknown-quote-fields.interceptor';
import { QuotesService } from './quotes.service';

@ApiTags('Public Quotes')
@Controller('public/quotes')
export class PublicQuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(RejectUnknownQuoteFieldsInterceptor)
  @ApiOperation({ summary: 'Registrar una cotización pública' })
  @ApiBody({ type: CreatePublicQuoteDto })
  @ApiCreatedResponse({
    description: 'Cotización registrada correctamente',
    type: CreatePublicQuoteResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Payload, formato, tipo o campo desconocido',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Solución u opción inexistente, inactiva o incompatible',
  })
  @ApiResponse({ status: 429, description: 'Demasiadas solicitudes' })
  @ApiResponse({
    status: 503,
    description: 'No fue posible registrar la cotización',
  })
  async create(@Body() dto: CreatePublicQuoteDto) {
    const data = await this.quotesService.createPublic(dto);

    return {
      success: true,
      message: 'Cotización registrada correctamente',
      data,
    };
  }
}
