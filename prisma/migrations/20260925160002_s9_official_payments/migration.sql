-- AlterTable
ALTER TABLE `Project` ADD COLUMN `quoteId` INTEGER NULL;

-- CreateTable
CREATE TABLE `QuoteVersion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quoteId` INTEGER NOT NULL,
    `version` INTEGER NOT NULL,
    `clientUserId` INTEGER NOT NULL,
    `authorId` INTEGER NOT NULL,
    `observations` VARCHAR(2000) NULL,
    `amountMinor` DECIMAL(15, 0) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `scope` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `officialAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuoteVersion_clientUserId_createdAt_idx`(`clientUserId`, `createdAt`),
    INDEX `QuoteVersion_authorId_idx`(`authorId`),
    UNIQUE INDEX `QuoteVersion_quoteId_version_key`(`quoteId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentSchedule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quoteVersionId` INTEGER NOT NULL,
    `sequence` INTEGER NOT NULL,
    `percentageBasisPoints` INTEGER NOT NULL,
    `amountMinor` DECIMAL(15, 0) NOT NULL,
    `dueDate` DATE NOT NULL,
    `milestone` VARCHAR(150) NOT NULL,

    INDEX `PaymentSchedule_dueDate_idx`(`dueDate`),
    UNIQUE INDEX `PaymentSchedule_quoteVersionId_sequence_key`(`quoteVersionId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scheduleId` INTEGER NOT NULL,
    `externalEventId` VARCHAR(150) NOT NULL,
    `amountMinor` DECIMAL(15, 0) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `status` ENUM('CONFIRMED', 'FAILED') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Payment_externalEventId_key`(`externalEventId`),
    INDEX `Payment_scheduleId_status_idx`(`scheduleId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Project_quoteId_key` ON `Project`(`quoteId`);

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuoteVersion` ADD CONSTRAINT `QuoteVersion_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuoteVersion` ADD CONSTRAINT `QuoteVersion_clientUserId_fkey` FOREIGN KEY (`clientUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuoteVersion` ADD CONSTRAINT `QuoteVersion_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentSchedule` ADD CONSTRAINT `PaymentSchedule_quoteVersionId_fkey` FOREIGN KEY (`quoteVersionId`) REFERENCES `QuoteVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `PaymentSchedule`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

