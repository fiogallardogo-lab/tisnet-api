CREATE TABLE `AdvisorAvailabilitySlot` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `advisorProfileId` INTEGER NOT NULL,
  `start` DATETIME(3) NOT NULL,
  `end` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `AdvisorAvailabilitySlot_advisorProfileId_start_end_key` (`advisorProfileId`, `start`, `end`),
  INDEX `AdvisorAvailabilitySlot_advisorProfileId_start_idx` (`advisorProfileId`, `start`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AdvisorAvailabilitySlot`
  ADD CONSTRAINT `AdvisorAvailabilitySlot_advisorProfileId_fkey`
  FOREIGN KEY (`advisorProfileId`) REFERENCES `AdminProfile`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
