-- AlterTable
ALTER TABLE `Quote` ADD COLUMN `prospectId` INTEGER NULL;

-- CreateTable
CREATE TABLE `Prospect` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `company` VARCHAR(150) NULL,
    `status` ENUM('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST') NOT NULL DEFAULT 'NEW',
    `source` ENUM('QUOTE', 'MEETING', 'MANUAL') NOT NULL DEFAULT 'QUOTE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Prospect_userId_key`(`userId`),
    UNIQUE INDEX `Prospect_email_key`(`email`),
    INDEX `Prospect_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `Prospect_source_createdAt_idx`(`source`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Meeting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `prospectId` INTEGER NOT NULL,
    `quoteId` INTEGER NULL,
    `advisorProfileId` INTEGER NULL,
    `status` ENUM('REQUESTED', 'CONFIRMED', 'CANCELED', 'COMPLETED') NOT NULL DEFAULT 'REQUESTED',
    `scheduledAt` DATETIME(3) NULL,
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'America/Lima',
    `notes` VARCHAR(1000) NULL,
    `externalProvider` VARCHAR(50) NULL,
    `externalEventUri` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Meeting_externalEventUri_key`(`externalEventUri`),
    INDEX `Meeting_prospectId_createdAt_idx`(`prospectId`, `createdAt`),
    INDEX `Meeting_quoteId_idx`(`quoteId`),
    INDEX `Meeting_advisorProfileId_scheduledAt_idx`(`advisorProfileId`, `scheduledAt`),
    INDEX `Meeting_status_scheduledAt_idx`(`status`, `scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Quote_prospectId_createdAt_idx` ON `Quote`(`prospectId`, `createdAt`);

-- AddForeignKey
ALTER TABLE `Prospect` ADD CONSTRAINT `Prospect_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_prospectId_fkey` FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Meeting` ADD CONSTRAINT `Meeting_prospectId_fkey` FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Meeting` ADD CONSTRAINT `Meeting_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Meeting` ADD CONSTRAINT `Meeting_advisorProfileId_fkey` FOREIGN KEY (`advisorProfileId`) REFERENCES `AdminProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
