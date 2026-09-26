-- AlterTable
ALTER TABLE `quoteversion` ADD COLUMN `acceptedAt` DATETIME(3) NULL,
    ADD COLUMN `acceptedByUserId` INTEGER NULL;

-- AlterTable
ALTER TABLE `teamapplication` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AddForeignKey
ALTER TABLE `QuoteVersion` ADD CONSTRAINT `QuoteVersion_acceptedByUserId_fkey` FOREIGN KEY (`acceptedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

