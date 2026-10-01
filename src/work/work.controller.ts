import { ApiWorkErrors } from './work-errors';
import { ApiWorkResponse } from './work-swagger';
import {
  TaskDto,
  TaskPageDto,
  ResourceDto,
  ResourcePageDto,
  WorkLogDto,
  WorkLogPageDto,
} from './work-response.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WorkService, WorkActor } from './work.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  TaskQuery,
  WorkPageQuery,
  CreateResourceDto,
  UpdateResourceDto,
  CreateWorkLogDto,
  LogQuery,
} from './work.dto';
type Req = { user: WorkActor };
@ApiWorkErrors()
@ApiTags('Project work')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CLIENT', 'DEVELOPER', 'PRODUCT_OWNER', 'ADMIN', 'SUPER_ADMIN')
@Controller('projects/:projectId')
export class WorkController {
  constructor(private readonly service: WorkService) {}
  @Get('tasks') @ApiWorkResponse(TaskPageDto, 200) tasks(
    @Param('projectId', ParseIntPipe) p: number,
    @Request() r: Req,
    @Query() q: TaskQuery,
  ) {
    return this.service.tasks(p, r.user, q);
  }
  @Post('tasks')
  @ApiWorkResponse(TaskDto, 201)
  @Roles('PRODUCT_OWNER', 'ADMIN', 'SUPER_ADMIN')
  createTask(
    @Param('projectId', ParseIntPipe) p: number,
    @Request() r: Req,
    @Body() d: CreateTaskDto,
  ) {
    return this.service.createTask(p, r.user, d);
  }
  @Patch('tasks/:id')
  @ApiWorkResponse(TaskDto, 200)
  @Roles('DEVELOPER', 'PRODUCT_OWNER', 'ADMIN', 'SUPER_ADMIN')
  updateTask(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) id: number,
    @Request() r: Req,
    @Body() d: UpdateTaskDto,
  ) {
    return this.service.updateTask(p, id, r.user, d);
  }
  @Delete('tasks/:id')
  @ApiWorkResponse(undefined, 200)
  @Roles('PRODUCT_OWNER', 'ADMIN', 'SUPER_ADMIN')
  deleteTask(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) id: number,
    @Request() r: Req,
  ) {
    return this.service.deleteTask(p, id, r.user);
  }
  @Get('resources') @ApiWorkResponse(ResourcePageDto, 200) resources(
    @Param('projectId', ParseIntPipe) p: number,
    @Request() r: Req,
    @Query() q: WorkPageQuery,
  ) {
    return this.service.resources(p, r.user, q);
  }
  @Post('resources')
  @ApiWorkResponse(ResourceDto, 201)
  @Roles('DEVELOPER', 'PRODUCT_OWNER', 'ADMIN', 'SUPER_ADMIN')
  createResource(
    @Param('projectId', ParseIntPipe) p: number,
    @Request() r: Req,
    @Body() d: CreateResourceDto,
  ) {
    return this.service.saveResource(p, r.user, d);
  }
  @Patch('resources/:id')
  @ApiWorkResponse(ResourceDto, 200)
  @Roles('DEVELOPER', 'PRODUCT_OWNER', 'ADMIN', 'SUPER_ADMIN')
  updateResource(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) id: number,
    @Request() r: Req,
    @Body() d: UpdateResourceDto,
  ) {
    return this.service.saveResource(p, r.user, d, id);
  }
  @Delete('resources/:id')
  @ApiWorkResponse(undefined, 200)
  @Roles('DEVELOPER', 'PRODUCT_OWNER', 'ADMIN', 'SUPER_ADMIN')
  deleteResource(
    @Param('projectId', ParseIntPipe) p: number,
    @Param('id', ParseIntPipe) id: number,
    @Request() r: Req,
  ) {
    return this.service.deleteResource(p, id, r.user);
  }
  @Get('work-logs')
  @ApiWorkResponse(WorkLogPageDto, 200)
  @Roles('DEVELOPER', 'PRODUCT_OWNER', 'ADMIN', 'SUPER_ADMIN')
  logs(
    @Param('projectId', ParseIntPipe) p: number,
    @Request() r: Req,
    @Query() q: LogQuery,
  ) {
    return this.service.logs(p, r.user, q);
  }
  @Post('work-logs')
  @ApiWorkResponse(WorkLogDto, 201)
  @Roles('DEVELOPER', 'PRODUCT_OWNER')
  createLog(
    @Param('projectId', ParseIntPipe) p: number,
    @Request() r: Req,
    @Body() d: CreateWorkLogDto,
  ) {
    return this.service.createLog(p, r.user, d);
  }
}
