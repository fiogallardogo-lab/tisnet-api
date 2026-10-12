-- Operational milestones can exist without a commercial installment.
-- Preserve an index for the foreign key before dropping its unique index.
ALTER TABLE `ProjectMilestone`
  ADD INDEX `ProjectMilestone_paymentScheduleId_idx` (`paymentScheduleId`);

ALTER TABLE `ProjectMilestone`
  DROP INDEX `ProjectMilestone_paymentScheduleId_key`,
  MODIFY `paymentScheduleId` INTEGER NULL;

-- A single operational milestone can contain several deliverables.
ALTER TABLE `ProjectDeliverable`
  DROP INDEX `ProjectDeliverable_projectId_milestoneOrder_key`,
  ADD INDEX `ProjectDeliverable_projectId_milestoneOrder_idx` (`projectId`, `milestoneOrder`);

-- Tasks belong to operational milestones and track blockers and priority.
ALTER TABLE `WorkTask`
  ADD COLUMN `milestoneId` INTEGER NULL,
  ADD COLUMN `priority` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN `blockedReason` VARCHAR(1000) NULL,
  MODIFY `status` ENUM('TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE') NOT NULL DEFAULT 'TODO',
  ADD INDEX `WorkTask_projectId_milestoneId_idx` (`projectId`, `milestoneId`),
  ADD CONSTRAINT `WorkTask_milestoneId_fkey` FOREIGN KEY (`milestoneId`) REFERENCES `ProjectMilestone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;