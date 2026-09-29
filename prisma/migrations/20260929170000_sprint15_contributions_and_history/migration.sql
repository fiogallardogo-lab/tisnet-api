-- CreateTable
CREATE TABLE `DeliverableHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `deliverableId` INTEGER NOT NULL,
    `actorId` INTEGER NOT NULL,
    `action` ENUM('SUBMITTED', 'OBSERVED', 'APPROVED', 'EVIDENCE_UPDATED') NOT NULL,
    `fileUrl` VARCHAR(500) NULL,
    `externalLink` VARCHAR(500) NULL,
    `feedbackNotes` VARCHAR(2000) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DeliverableHistory_deliverableId_createdAt_idx`(`deliverableId`, `createdAt`),
    INDEX `DeliverableHistory_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MilestoneContribution` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `milestoneId` INTEGER NULL,
    `deliverableId` INTEGER NULL,
    `userId` INTEGER NOT NULL,
    `percentage` INTEGER NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MilestoneContribution_projectId_idx`(`projectId`),
    INDEX `MilestoneContribution_milestoneId_idx`(`milestoneId`),
    INDEX `MilestoneContribution_userId_idx`(`userId`),
    UNIQUE INDEX `MilestoneContribution_projectId_deliverableId_userId_key`(`projectId`, `deliverableId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DeliverableHistory` ADD CONSTRAINT `DeliverableHistory_deliverableId_fkey` FOREIGN KEY (`deliverableId`) REFERENCES `ProjectDeliverable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliverableHistory` ADD CONSTRAINT `DeliverableHistory_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MilestoneContribution` ADD CONSTRAINT `MilestoneContribution_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MilestoneContribution` ADD CONSTRAINT `MilestoneContribution_milestoneId_fkey` FOREIGN KEY (`milestoneId`) REFERENCES `ProjectMilestone`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MilestoneContribution` ADD CONSTRAINT `MilestoneContribution_deliverableId_fkey` FOREIGN KEY (`deliverableId`) REFERENCES `ProjectDeliverable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MilestoneContribution` ADD CONSTRAINT `MilestoneContribution_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
