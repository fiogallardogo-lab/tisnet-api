-- CreateTable
CREATE TABLE `QuoteObservation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quoteId` INTEGER NOT NULL,
    `versionId` INTEGER NOT NULL,
    `authorId` INTEGER NOT NULL,
    `text` VARCHAR(2000) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuoteObservation_quoteId_createdAt_idx`(`quoteId`, `createdAt`),
    INDEX `QuoteObservation_versionId_idx`(`versionId`),
    INDEX `QuoteObservation_authorId_idx`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContactInquiry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `subject` VARCHAR(150) NOT NULL,
    `message` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ContactInquiry_code_key`(`code`),
    INDEX `ContactInquiry_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `QuoteObservation` ADD CONSTRAINT `QuoteObservation_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuoteObservation` ADD CONSTRAINT `QuoteObservation_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `QuoteVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuoteObservation` ADD CONSTRAINT `QuoteObservation_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

