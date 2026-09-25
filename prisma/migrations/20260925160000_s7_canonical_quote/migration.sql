-- AlterTable
ALTER TABLE `Quote` ADD COLUMN `activeVersion` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `deliveryMode` VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN `legacyCode` VARCHAR(100) NULL,
    ADD COLUMN `legacyPublicQuoteId` INTEGER NULL,
    ADD COLUMN `snapshot` JSON NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Quote_legacyCode_key` ON `Quote`(`legacyCode`);

-- CreateIndex
CREATE UNIQUE INDEX `Quote_legacyPublicQuoteId_key` ON `Quote`(`legacyPublicQuoteId`);

