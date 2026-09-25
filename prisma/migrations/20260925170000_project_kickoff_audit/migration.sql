-- AlterTable
ALTER TABLE `Project` ADD COLUMN `clientUserId` INTEGER NULL,
    ADD COLUMN `productOwnerId` INTEGER NULL,
    ADD COLUMN `prospectId` INTEGER NULL;

-- AlterTable
ALTER TABLE `ProjectMember` ADD COLUMN `participationBasisPoints` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `ProjectDeliverable` ADD COLUMN `milestoneId` INTEGER NULL;

-- CreateTable
CREATE TABLE `Kickoff` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `actorId` INTEGER NOT NULL,
    `heldAt` DATETIME(3) NOT NULL,
    `notes` VARCHAR(2000) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Kickoff_projectId_key`(`projectId`),
    INDEX `Kickoff_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectMilestone` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `paymentScheduleId` INTEGER NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `dueDate` DATE NOT NULL,
    `sequence` INTEGER NOT NULL,

    UNIQUE INDEX `ProjectMilestone_paymentScheduleId_key`(`paymentScheduleId`),
    UNIQUE INDEX `ProjectMilestone_projectId_sequence_key`(`projectId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actorId` INTEGER NULL,
    `action` VARCHAR(100) NOT NULL,
    `entityType` VARCHAR(50) NOT NULL,
    `entityId` VARCHAR(100) NOT NULL,
    `metadata` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditEvent_entityType_createdAt_id_idx`(`entityType`, `createdAt`, `id`),
    INDEX `AuditEvent_actorId_createdAt_id_idx`(`actorId`, `createdAt`, `id`),
    INDEX `AuditEvent_createdAt_id_idx`(`createdAt`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Project_clientUserId_status_idx` ON `Project`(`clientUserId`, `status`);

-- CreateIndex
CREATE INDEX `Project_prospectId_idx` ON `Project`(`prospectId`);

-- CreateIndex
CREATE INDEX `Project_productOwnerId_status_idx` ON `Project`(`productOwnerId`, `status`);

-- CreateIndex
CREATE INDEX `ProjectDeliverable_milestoneId_idx` ON `ProjectDeliverable`(`milestoneId`);

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_clientUserId_fkey` FOREIGN KEY (`clientUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_prospectId_fkey` FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_productOwnerId_fkey` FOREIGN KEY (`productOwnerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectDeliverable` ADD CONSTRAINT `ProjectDeliverable_milestoneId_fkey` FOREIGN KEY (`milestoneId`) REFERENCES `ProjectMilestone`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Kickoff` ADD CONSTRAINT `Kickoff_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Kickoff` ADD CONSTRAINT `Kickoff_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMilestone` ADD CONSTRAINT `ProjectMilestone_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMilestone` ADD CONSTRAINT `ProjectMilestone_paymentScheduleId_fkey` FOREIGN KEY (`paymentScheduleId`) REFERENCES `PaymentSchedule`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
