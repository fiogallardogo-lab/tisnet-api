-- AlterTable
ALTER TABLE `user` ADD COLUMN `acceptedTermsAt` DATETIME(3) NULL,
    ADD COLUMN `privacyVersion` VARCHAR(50) NULL,
    ADD COLUMN `termsVersion` VARCHAR(50) NULL;

-- CreateTable
CREATE TABLE `ClientProfile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `dni` VARCHAR(8) NULL,
    `age` INTEGER NULL,
    `phone` VARCHAR(20) NULL,
    `district` VARCHAR(100) NULL,
    `businessName` VARCHAR(150) NULL,
    `ruc` VARCHAR(11) NULL,
    `commercialName` VARCHAR(150) NULL,
    `businessDistrict` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ClientProfile_userId_key`(`userId`),
    UNIQUE INDEX `ClientProfile_dni_key`(`dni`),
    UNIQUE INDEX `ClientProfile_ruc_key`(`ruc`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeveloperProfile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `career` VARCHAR(150) NULL,
    `university` VARCHAR(180) NULL,
    `academicStatus` VARCHAR(100) NULL,
    `experienceYears` INTEGER NULL,
    `specialty` VARCHAR(120) NULL,
    `cvUrl` VARCHAR(500) NULL,
    `photoUrl` VARCHAR(500) NULL,
    `linkedinUrl` VARCHAR(500) NULL,
    `githubUrl` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DeveloperProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeveloperTechnology` (
    `developerProfileId` INTEGER NOT NULL,
    `technologyId` INTEGER NOT NULL,

    INDEX `DeveloperTechnology_technologyId_idx`(`technologyId`),
    PRIMARY KEY (`developerProfileId`, `technologyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductOwnerProfile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `bio` TEXT NULL,
    `specialty` VARCHAR(120) NULL,
    `availabilityNotes` VARCHAR(500) NULL,
    `photoUrl` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductOwnerProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminProfile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `executiveTitle` VARCHAR(120) NULL,
    `specialty` VARCHAR(120) NULL,
    `photoUrl` VARCHAR(500) NULL,
    `calendlyUrl` VARCHAR(500) NULL,
    `isPublicAdvisor` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AdminProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Quote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicCode` VARCHAR(20) NOT NULL,
    `status` ENUM('RECEIVED') NOT NULL DEFAULT 'RECEIVED',
    `solutionType` VARCHAR(64) NOT NULL,
    `contactName` VARCHAR(100) NOT NULL,
    `contactEmail` VARCHAR(150) NOT NULL,
    `contactPhone` VARCHAR(30) NOT NULL,
    `contactCompany` VARCHAR(150) NULL,
    `notes` TEXT NULL,
    `pricingStatus` ENUM('PENDING_RULES', 'CALCULATED') NOT NULL DEFAULT 'PENDING_RULES',
    `amountMinor` DECIMAL(15, 0) NULL,
    `currency` CHAR(3) NULL,
    `pricingVersion` VARCHAR(50) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Quote_publicCode_key`(`publicCode`),
    INDEX `Quote_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `Quote_pricingStatus_createdAt_idx`(`pricingStatus`, `createdAt`),
    INDEX `Quote_solutionType_createdAt_idx`(`solutionType`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuoteOption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quoteId` INTEGER NOT NULL,
    `optionCode` VARCHAR(64) NOT NULL,
    `optionName` VARCHAR(150) NOT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuoteOption_quoteId_displayOrder_idx`(`quoteId`, `displayOrder`),
    UNIQUE INDEX `QuoteOption_quoteId_optionCode_key`(`quoteId`, `optionCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuoteItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quoteId` INTEGER NOT NULL,
    `itemCode` VARCHAR(64) NOT NULL,
    `label` VARCHAR(150) NOT NULL,
    `amountMinor` DECIMAL(15, 0) NOT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuoteItem_quoteId_displayOrder_idx`(`quoteId`, `displayOrder`),
    UNIQUE INDEX `QuoteItem_quoteId_itemCode_key`(`quoteId`, `itemCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `User_roleId_isActive_idx` ON `User`(`roleId`, `isActive`);

-- AddForeignKey
ALTER TABLE `ClientProfile` ADD CONSTRAINT `ClientProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeveloperProfile` ADD CONSTRAINT `DeveloperProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeveloperTechnology` ADD CONSTRAINT `DeveloperTechnology_developerProfileId_fkey` FOREIGN KEY (`developerProfileId`) REFERENCES `DeveloperProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeveloperTechnology` ADD CONSTRAINT `DeveloperTechnology_technologyId_fkey` FOREIGN KEY (`technologyId`) REFERENCES `Technology`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductOwnerProfile` ADD CONSTRAINT `ProductOwnerProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminProfile` ADD CONSTRAINT `AdminProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuoteOption` ADD CONSTRAINT `QuoteOption_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuoteItem` ADD CONSTRAINT `QuoteItem_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
