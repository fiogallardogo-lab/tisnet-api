import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiConflictResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PLATFORM_ROLES } from '../common/constants/platform-roles';

import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Crear un usuario mediante alta administrativa',
    description:
      'Solo ADMIN/SUPER_ADMIN. Crea CLIENT, DEVELOPER, PRODUCT_OWNER o ADMIN con su perfil. No permite crear SUPER_ADMIN. acceptedTerms debe ser true; termsVersion/privacyVersion deben coincidir con TERMS_VERSION/PRIVACY_VERSION del backend. Persiste acceptedTermsAt del servidor.',
  })
  @ApiCreatedResponse({
    description:
      'Usuario y perfil creados. data: id, name, email, role, isActive, acceptedTermsAt, termsVersion, privacyVersion; sin passwordHash.',
  })
  @ApiBadRequestResponse({
    description:
      'DTO, consentimiento, rol creado o versiones legales inválidos.',
  })
  @ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
  @ApiForbiddenResponse({ description: 'El actor no es ADMIN ni SUPER_ADMIN.' })
  @ApiConflictResponse({ description: 'El correo ya está registrado.' })
  @ApiServiceUnavailableResponse({
    description: 'Configuración legal ausente o inválida; no se crean datos.',
  })
  createUser(@Body() dto: CreateUserDto) {
    return this.usersService.createAdministrativeUser(dto);
  }
}
