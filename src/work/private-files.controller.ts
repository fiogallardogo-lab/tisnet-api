import { ApiOkResponse } from '@nestjs/swagger';
import { ApiWorkErrors } from './work-errors';
import { ApiWorkResponse } from './work-swagger';
import { PrivateFileDto, CvFileDto } from './work-response.dto';
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrivateFilesService, WorkUpload } from './private-files.service';
import { WorkActor } from './work.service';
const uploadSchema = {
  type: 'object',
  required: ['file'],
  properties: { file: { type: 'string', format: 'binary' } },
};
@ApiWorkErrors()
@ApiTags('Private files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class PrivateFilesController {
  constructor(private readonly files: PrivateFilesService) {}
  @Post('users/me/cv')
  @ApiWorkResponse(CvFileDto, 201)
  @Roles('DEVELOPER')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: uploadSchema })
  uploadCv(@Request() r: { user: WorkActor }, @UploadedFile() f: WorkUpload) {
    return this.files.upload(r.user, f);
  }
  @ApiOkResponse({
    content: {
      'application/pdf': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @Get('users/me/cv/:id')
  @Roles('DEVELOPER')
  cv(
    @Request() r: { user: WorkActor },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.files.download(r.user, id);
  }
  @Post('projects/:projectId/files')
  @ApiWorkResponse(PrivateFileDto, 201)
  @Roles('DEVELOPER', 'PRODUCT_OWNER', 'ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: uploadSchema })
  uploadProject(
    @Param('projectId', ParseIntPipe) p: number,
    @Request() r: { user: WorkActor },
    @UploadedFile() f: WorkUpload,
  ) {
    return this.files.upload(r.user, f, p);
  }
  @ApiOkResponse({
    content: {
      'application/pdf': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @Get('projects/:projectId/files/:id/download')
  @Roles('CLIENT', 'DEVELOPER', 'PRODUCT_OWNER', 'ADMIN', 'SUPER_ADMIN')
  projectFile(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseUUIDPipe) id: string,
    @Request() r: { user: WorkActor },
  ) {
    return this.files.download(r.user, id, p);
  }
}
