-- AlterTable
ALTER TABLE `TeamApplication`
    ADD COLUMN `assignedAdminProfileId` INTEGER NULL,
    ADD COLUMN `reviewedByUserId` INTEGER NULL,
    ADD COLUMN `interviewAssignedAt` DATETIME(3) NULL,
    ADD COLUMN `rejectionReason` VARCHAR(1000) NULL,
    ADD COLUMN `rejectedAt` DATETIME(3) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateIndex
CREATE INDEX `TeamApplication_status_createdAt_idx`
    ON `TeamApplication`(`status`, `createdAt`);

-- CreateIndex
CREATE INDEX `TeamApplication_requestedRole_status_createdAt_idx`
    ON `TeamApplication`(`requestedRole`, `status`, `createdAt`);

-- CreateIndex
CREATE INDEX `TeamApplication_assignedAdminProfileId_status_idx`
    ON `TeamApplication`(`assignedAdminProfileId`, `status`);

-- CreateIndex
CREATE INDEX `TeamApplication_reviewedByUserId_idx`
    ON `TeamApplication`(`reviewedByUserId`);

-- AddForeignKey
ALTER TABLE `TeamApplication`
    ADD CONSTRAINT `TeamApplication_assignedAdminProfileId_fkey`
    FOREIGN KEY (`assignedAdminProfileId`) REFERENCES `AdminProfile`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamApplication`
    ADD CONSTRAINT `TeamApplication_reviewedByUserId_fkey`
    FOREIGN KEY (`reviewedByUserId`) REFERENCES `User`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
