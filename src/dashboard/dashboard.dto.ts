import { ApiProperty } from '@nestjs/swagger';
export class DashboardUserDto {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
  @ApiProperty() role!: string;
}
export class DashboardStatsDto {
  @ApiProperty() projects!: number;
  @ApiProperty() openTasks!: number;
  @ApiProperty() pendingDeliverables!: number;
  @ApiProperty() overdueTasks!: number;
  @ApiProperty() meetings!: number;
  @ApiProperty() quotes!: number;
  @ApiProperty() prospects!: number;
}
export class DashboardProjectDto {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
  @ApiProperty() status!: string;
  @ApiProperty() totalDeliverables!: number;
  @ApiProperty() approvedDeliverables!: number;
  @ApiProperty() progress!: number;
}
export class DashboardTaskDto {
  @ApiProperty() id!: number;
  @ApiProperty() projectId!: number;
  @ApiProperty() title!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ type: Number, nullable: true }) assigneeId!: number | null;
  @ApiProperty({ type: String, nullable: true }) dueDate!: string | null;
}
export class DashboardMeetingDto {
  @ApiProperty() id!: number;
  @ApiProperty() status!: string;
  @ApiProperty({ type: String, nullable: true }) scheduledAt!: string | null;
  @ApiProperty() timezone!: string;
}
export class DashboardWorkloadDto {
  @ApiProperty() userId!: number;
  @ApiProperty() openTasks!: number;
}
export class DashboardDistributionDto {
  @ApiProperty() label!: string;
  @ApiProperty() count!: number;
}
export class DashboardIntegrationDto {
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['CONFIGURED', 'NOT_CONFIGURED'] }) status!:
    'CONFIGURED' | 'NOT_CONFIGURED';
  @ApiProperty({ example: 'NOT_PROBED' }) connectivity!: 'NOT_PROBED';
}
export class DashboardDeliverableDto {
  @ApiProperty() id!: number;
  @ApiProperty() projectId!: number;
  @ApiProperty() title!: string;
  @ApiProperty() status!: string;
  @ApiProperty() dueDate!: string;
}
export class DashboardRevenueDto {
  @ApiProperty() currency!: string;
  @ApiProperty({ description: 'Unidades menores como cadena decimal exacta' })
  confirmedAmountMinor!: string;
}
export class DashboardDto {
  @ApiProperty() generatedAt!: string;
  @ApiProperty({ type: DashboardUserDto }) user!: DashboardUserDto;
  @ApiProperty({ type: DashboardStatsDto }) stats!: DashboardStatsDto;
  @ApiProperty({ type: [DashboardProjectDto] })
  projects!: DashboardProjectDto[];
  @ApiProperty({ type: [DashboardDeliverableDto] })
  deliverables!: DashboardDeliverableDto[];
  @ApiProperty({ type: [DashboardRevenueDto] }) revenue!: DashboardRevenueDto[];
  @ApiProperty({ type: [DashboardTaskDto] }) tasks!: DashboardTaskDto[];
  @ApiProperty({ type: [DashboardMeetingDto] })
  meetings!: DashboardMeetingDto[];
  @ApiProperty({ type: [DashboardWorkloadDto] })
  workload!: DashboardWorkloadDto[];
  @ApiProperty({ type: [DashboardDistributionDto] })
  usersByRole!: DashboardDistributionDto[];
  @ApiProperty({ type: [DashboardDistributionDto] })
  projectsByStatus!: DashboardDistributionDto[];
  @ApiProperty({ type: [DashboardIntegrationDto] })
  integrations!: DashboardIntegrationDto[];
  @ApiProperty({
    example: 'READ_OK',
    description:
      'Lecturas DB de esta solicitud, no salud de proveedores externos',
  })
  database!: 'READ_OK';
  @ApiProperty({
    example: 50,
    description:
      'Máximo de cada colección de vista previa; stats cuenta el alcance completo',
  })
  previewLimit!: number;
}
export class ClientDashboardDto extends DashboardDto {}
export class DeveloperDashboardDto extends DashboardDto {}
export class ProductOwnerDashboardDto extends DashboardDto {}
export class AdminDashboardDto extends DashboardDto {}
export class SuperAdminDashboardDto extends DashboardDto {}
