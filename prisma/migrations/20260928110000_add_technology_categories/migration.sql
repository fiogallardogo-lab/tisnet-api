-- CreateTable
CREATE TABLE `TechnologyCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TechnologyCategory_name_key`(`name`),
    UNIQUE INDEX `TechnologyCategory_slug_key`(`slug`),
    INDEX `TechnologyCategory_isActive_displayOrder_idx`(`isActive`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `Technology` ADD COLUMN `categoryId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Technology_categoryId_idx` ON `Technology`(`categoryId`);

-- CreateIndex
CREATE INDEX `Technology_isActive_categoryId_idx` ON `Technology`(`isActive`, `categoryId`);

-- AddForeignKey
ALTER TABLE `Technology` ADD CONSTRAINT `Technology_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `TechnologyCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
