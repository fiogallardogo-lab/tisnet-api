CREATE TABLE `ManualPaymentSubmission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scheduleId` INTEGER NOT NULL,
    `clientUserId` INTEGER NOT NULL,
    `status` ENUM('SUBMITTED', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'SUBMITTED',
    `operationNumber` VARCHAR(100) NOT NULL,
    `paymentMethod` VARCHAR(32) NOT NULL,
    `paidAt` DATETIME(3) NOT NULL,
    `amountMinor` DECIMAL(15, 0) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `storageKey` VARCHAR(255) NOT NULL,
    `receiptName` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `notes` VARCHAR(1000) NULL,
    `reviewNote` VARCHAR(1000) NULL,
    `reviewedById` INTEGER NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `ManualPaymentSubmission_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `ManualPaymentSubmission_scheduleId_status_idx`(`scheduleId`, `status`),
    INDEX `ManualPaymentSubmission_clientUserId_createdAt_idx`(`clientUserId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ManualPaymentSubmission`
    ADD CONSTRAINT `ManualPaymentSubmission_scheduleId_fkey`
    FOREIGN KEY (`scheduleId`) REFERENCES `PaymentSchedule`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ManualPaymentSubmission`
    ADD CONSTRAINT `ManualPaymentSubmission_clientUserId_fkey`
    FOREIGN KEY (`clientUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ManualPaymentSubmission`
    ADD CONSTRAINT `ManualPaymentSubmission_reviewedById_fkey`
    FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
