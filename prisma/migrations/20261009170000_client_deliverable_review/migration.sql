ALTER TABLE `ProjectDeliverable`
  ADD COLUMN `clientReviewStatus` ENUM('PENDING', 'APPROVED', 'OBSERVED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `clientReviewedAt` DATETIME(3) NULL,
  ADD COLUMN `clientReviewedById` INTEGER NULL,
  ADD COLUMN `clientFeedbackNotes` VARCHAR(2000) NULL,
  ADD INDEX `ProjectDeliverable_clientReviewedById_idx` (`clientReviewedById`);

ALTER TABLE `ProjectDeliverable`
  ADD CONSTRAINT `ProjectDeliverable_clientReviewedById_fkey`
  FOREIGN KEY (`clientReviewedById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
