-- Add an optional commercial advisor assignment to each prospect.
ALTER TABLE `Prospect`
  ADD COLUMN `advisorProfileId` INTEGER NULL;

CREATE INDEX `Prospect_advisorProfileId_createdAt_idx`
  ON `Prospect`(`advisorProfileId`, `createdAt`);

ALTER TABLE `Prospect`
  ADD CONSTRAINT `Prospect_advisorProfileId_fkey`
  FOREIGN KEY (`advisorProfileId`) REFERENCES `AdminProfile`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
