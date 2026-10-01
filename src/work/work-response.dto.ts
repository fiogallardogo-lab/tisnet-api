import { ApiProperty } from '@nestjs/swagger';
export class TaskDto {
  @ApiProperty() id!: number;
  @ApiProperty() projectId!: number;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: ['TODO', 'IN_PROGRESS', 'DONE'] }) status!:
    'TODO' | 'IN_PROGRESS' | 'DONE';
  @ApiProperty({ type: Number, nullable: true }) assigneeId!: number | null;
  @ApiProperty() createdById!: number;
  @ApiProperty({ type: String, nullable: true }) dueDate!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
export class ResourceDto {
  @ApiProperty() id!: number;
  @ApiProperty() projectId!: number;
  @ApiProperty() createdById!: number;
  @ApiProperty() name!: string;
  @ApiProperty() url!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
export class WorkLogDto {
  @ApiProperty() id!: number;
  @ApiProperty() projectId!: number;
  @ApiProperty() userId!: number;
  @ApiProperty({ type: Number, nullable: true }) taskId!: number | null;
  @ApiProperty() date!: string;
  @ApiProperty() minutes!: number;
  @ApiProperty() summary!: string;
  @ApiProperty() createdAt!: string;
}
export class PageDto {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalItems!: number;
  @ApiProperty() totalPages!: number;
}
export class TaskPageDto extends PageDto {
  @ApiProperty({ type: [TaskDto] }) items!: TaskDto[];
}
export class ResourcePageDto extends PageDto {
  @ApiProperty({ type: [ResourceDto] }) items!: ResourceDto[];
}
export class WorkLogPageDto extends PageDto {
  @ApiProperty({ type: [WorkLogDto] }) items!: WorkLogDto[];
}
export class PrivateFileDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() url!: string;
  @ApiProperty() filename!: string;
  @ApiProperty({ example: 'application/pdf' }) mimeType!: string;
  @ApiProperty() sizeBytes!: number;
}
export class CvFileDto extends PrivateFileDto {
  @ApiProperty() cvUrl!: string;
}
