import {
  Body,
  Controller,
  Get,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PLATFORM_ROLES } from '../common/constants/platform-roles';
import { UpdateAdminProfileDto } from './dto/update-admin-profile.dto';
import { UpdateClientProfileDto } from './dto/update-client-profile.dto';
import { UpdateDeveloperProfileDto } from './dto/update-developer-profile.dto';
import { UpdateOwnUserDto } from './dto/update-own-user.dto';
import { UpdateProductOwnerProfileDto } from './dto/update-product-owner-profile.dto';
import { ProfilesService } from './profiles.service';

interface ProfileRequest {
  user: { id: number; email: string; role: string };
}

@ApiTags('Profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/me')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Consultar el usuario y perfil del rol actual' })
  getOwnProfile(@Request() request: ProfileRequest) {
    return this.profilesService.getOwnProfile(request.user.id);
  }

  @Patch()
  @ApiOperation({
    summary: 'Actualizar el nombre o aceptación legal del usuario autenticado',
  })
  updateOwnUser(
    @Request() request: ProfileRequest,
    @Body() dto: UpdateOwnUserDto,
  ) {
    return this.profilesService.updateOwnUser(request.user.id, dto);
  }

  @Patch('client-profile')
  @UseGuards(RolesGuard)
  @Roles(PLATFORM_ROLES.CLIENT)
  @ApiOperation({ summary: 'Crear o actualizar el perfil CLIENT propio' })
  updateClientProfile(
    @Request() request: ProfileRequest,
    @Body() dto: UpdateClientProfileDto,
  ) {
    return this.profilesService.updateClientProfile(request.user.id, dto);
  }

  @Patch('developer-profile')
  @UseGuards(RolesGuard)
  @Roles(PLATFORM_ROLES.DEVELOPER)
  @ApiOperation({ summary: 'Crear o actualizar el perfil DEVELOPER propio' })
  updateDeveloperProfile(
    @Request() request: ProfileRequest,
    @Body() dto: UpdateDeveloperProfileDto,
  ) {
    return this.profilesService.updateDeveloperProfile(request.user.id, dto);
  }

  @Patch('product-owner-profile')
  @UseGuards(RolesGuard)
  @Roles(PLATFORM_ROLES.PRODUCT_OWNER)
  @ApiOperation({
    summary: 'Crear o actualizar el perfil PRODUCT_OWNER propio',
  })
  updateProductOwnerProfile(
    @Request() request: ProfileRequest,
    @Body() dto: UpdateProductOwnerProfileDto,
  ) {
    return this.profilesService.updateProductOwnerProfile(request.user.id, dto);
  }

  @Patch('admin-profile')
  @UseGuards(RolesGuard)
  @Roles(PLATFORM_ROLES.ADMIN)
  @ApiOperation({ summary: 'Crear o actualizar el perfil ADMIN propio' })
  updateAdminProfile(
    @Request() request: ProfileRequest,
    @Body() dto: UpdateAdminProfileDto,
  ) {
    return this.profilesService.updateAdminProfile(request.user.id, dto);
  }
}
