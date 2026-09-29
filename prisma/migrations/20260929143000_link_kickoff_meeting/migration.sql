ALTER TABLE `Kickoff` ADD COLUMN `meetingId` INTEGER NULL;
CREATE UNIQUE INDEX `Kickoff_meetingId_key` ON `Kickoff`(`meetingId`);
ALTER TABLE `Kickoff` ADD CONSTRAINT `Kickoff_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
