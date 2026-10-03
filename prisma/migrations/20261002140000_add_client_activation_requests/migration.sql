CREATE TABLE `ClientActivationRequest` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `prospectId` INTEGER NOT NULL,
  `requesterId` INTEGER NOT NULL,
  `reviewerId` INTEGER NULL,
  `clientUserId` INTEGER NULL,
  `status` ENUM('PENDING', 'APPROVED') NOT NULL DEFAULT 'PENDING',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewedAt` DATETIME(3) NULL,

  UNIQUE INDEX `ClientActivationRequest_clientUserId_key` (`clientUserId`),
  INDEX `ClientActivationRequest_status_createdAt_idx` (`status`, `createdAt`),
  UNIQUE INDEX `ClientActivationRequest_prospectId_status_key` (`prospectId`, `status`),
  INDEX `ClientActivationRequest_requesterId_createdAt_idx` (`requesterId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ClientActivationRequest`
  ADD CONSTRAINT `ClientActivationRequest_prospectId_fkey`
  FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ClientActivationRequest`
  ADD CONSTRAINT `ClientActivationRequest_requesterId_fkey`
  FOREIGN KEY (`requesterId`) REFERENCES `User`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ClientActivationRequest`
  ADD CONSTRAINT `ClientActivationRequest_reviewerId_fkey`
  FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ClientActivationRequest`
  ADD CONSTRAINT `ClientActivationRequest_clientUserId_fkey`
  FOREIGN KEY (`clientUserId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
