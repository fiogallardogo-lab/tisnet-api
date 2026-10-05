import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PLATFORM_ROLES } from '../common/constants/platform-roles';

import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Listar cuentas de usuario',
    description:
      'Solo ADMIN/SUPER_ADMIN. Lista las cuentas existentes con paginación, búsqueda por nombre o correo y filtro por estado.',
  })
  @ApiOkResponse({
    description:
      'Listado paginado de usuarios. No expone passwordHash ni otros datos sensibles.',
  })
  @ApiUnauthorizedResponse({
    description: 'JWT ausente o inválido.',
  })
  @ApiForbiddenResponse({
    description: 'El actor no es ADMIN ni SUPER_ADMIN.',
  })
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.usersService.listUsers(query);
  }

  @Patch(':id')
  @Roles(PLATFORM_ROLES.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Actualizar rol o estado de una cuenta gestionable',
  })
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: { user: { id: number } },
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateManagedUser(id, request.user.id, dto);
  }

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
  @ApiUnauthorizedResponse({
    description: 'JWT ausente o inválido.',
  })
  @ApiForbiddenResponse({
    description: 'El actor no es ADMIN ni SUPER_ADMIN.',
  })
  @ApiConflictResponse({
    description: 'El correo ya está registrado.',
  })
  @ApiServiceUnavailableResponse({
    description: 'Configuración legal ausente o inválida; no se crean datos.',
  })
  createUser(
    @Body() dto: CreateUserDto,
    @Request() request?: { user?: { id?: number } },
  ) {
    const actorId = request?.user?.id;
    return actorId !== undefined
      ? this.usersService.createAdministrativeUser(dto, actorId)
      : this.usersService.createAdministrativeUser(dto);
  }
}
