-- CreateTable
CREATE TABLE `Project` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(180) NOT NULL,
    `shortDescription` VARCHAR(300) NOT NULL,
    `description` TEXT NOT NULL,
    `problem` TEXT NULL,
    `solution` TEXT NULL,
    `objective` TEXT NULL,
    `features` JSON NULL,
    `categoryId` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'IN_DEVELOPMENT', 'IN_REVIEW', 'COMPLETED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `developmentDate` DATE NULL,
    `clientName` VARCHAR(150) NULL,
    `demoUrl` VARCHAR(500) NULL,
    `externalUrl` VARCHAR(500) NULL,
    `coverImageUrl` VARCHAR(500) NULL,
    `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Project_slug_key`(`slug`),
    INDEX `Project_categoryId_idx`(`categoryId`),
    INDEX `Project_status_idx`(`status`),
    INDEX `Project_isPublished_displayOrder_idx`(`isPublished`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectTechnology` (
    `projectId` INTEGER NOT NULL,
    `technologyId` INTEGER NOT NULL,

    INDEX `ProjectTechnology_technologyId_idx`(`technologyId`),
    PRIMARY KEY (`projectId`, `technologyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectTechnology` ADD CONSTRAINT `ProjectTechnology_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectTechnology` ADD CONSTRAINT `ProjectTechnology_technologyId_fkey` FOREIGN KEY (`technologyId`) REFERENCES `Technology`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
