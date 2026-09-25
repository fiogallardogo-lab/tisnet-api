-- AlterTable
ALTER TABLE `TeamApplication` ADD COLUMN `decidedAt` DATETIME(3) NULL,
    ADD COLUMN `decidedByUserId` INTEGER NULL,
    ADD COLUMN `decisionReason` VARCHAR(1000) NULL,
    ADD COLUMN `interviewCompletedAt` DATETIME(3) NULL,
    ADD COLUMN `resultingUserId` INTEGER NULL,
    MODIFY `requestedRole` ENUM('DEVELOPER', 'PRODUCT_OWNER') NOT NULL,
    MODIFY `status` ENUM('PENDING_REVIEW', 'INTERVIEW_ASSIGNED', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING_REVIEW';

-- CreateIndex
CREATE INDEX `TeamApplication_resultingUserId_idx` ON `TeamApplication`(`resultingUserId`);

-- CreateIndex
CREATE INDEX `TeamApplication_decidedByUserId_decidedAt_idx` ON `TeamApplication`(`decidedByUserId`, `decidedAt`);

-- AddForeignKey
ALTER TABLE `TeamApplication` ADD CONSTRAINT `TeamApplication_resultingUserId_fkey` FOREIGN KEY (`resultingUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamApplication` ADD CONSTRAINT `TeamApplication_decidedByUserId_fkey` FOREIGN KEY (`decidedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- Backfill only facts recorded by the legacy rejection flow. Do not infer an acceptance actor/date.
UPDATE `TeamApplication` SET `decidedAt`=`rejectedAt`, `decidedByUserId`=`reviewedByUserId`, `decisionReason`=`rejectionReason` WHERE `status`='REJECTED' AND `rejectedAt` IS NOT NULL;
UPDATE `TeamApplication` t JOIN `User` u ON u.`email`=t.`email` JOIN `Role` r ON r.`id`=u.`roleId` AND r.`name`=t.`requestedRole` SET t.`resultingUserId`=u.`id` WHERE t.`status`='ACCEPTED';
