import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service';

@ApiTags('Public Services')
@Controller('public/services')
export class PublicServicesController {
  constructor(private readonly servicesService: ServicesService) {}
}
