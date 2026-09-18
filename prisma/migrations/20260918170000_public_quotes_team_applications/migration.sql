
CREATE TABLE `PublicQuote` (
 `id` INTEGER NOT NULL AUTO_INCREMENT, `code` VARCHAR(100) NOT NULL,
 `solutionType` VARCHAR(40) NOT NULL, `deliveryMode` VARCHAR(20) NOT NULL,
 `contact` JSON NOT NULL, `notes` TEXT NULL, `snapshot` JSON NOT NULL,
 `pricingStatus` VARCHAR(30) NOT NULL, `amountMinor` INTEGER NULL,
 `currency` VARCHAR(3) NULL, `pricingVersion` VARCHAR(30) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE INDEX `PublicQuote_code_key` (`code`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `TeamApplication` (
 `id` INTEGER NOT NULL AUTO_INCREMENT, `code` VARCHAR(100) NOT NULL,
 `email` VARCHAR(150) NOT NULL, `dni` VARCHAR(8) NOT NULL,
 `requestedRole` VARCHAR(30) NOT NULL, `profile` JSON NOT NULL,
 `cv` LONGBLOB NOT NULL, `cvName` VARCHAR(255) NOT NULL,
 `photo` LONGBLOB NOT NULL, `photoMime` VARCHAR(30) NOT NULL,
 `consent` BOOLEAN NOT NULL, `status` VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW',
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE INDEX `TeamApplication_code_key` (`code`),
 UNIQUE INDEX `TeamApplication_email_key` (`email`),
 UNIQUE INDEX `TeamApplication_dni_key` (`dni`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
