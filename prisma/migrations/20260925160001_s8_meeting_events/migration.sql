-- AlterTable
ALTER TABLE `Meeting` ADD COLUMN `bookingKey` VARCHAR(180) NULL,
    ADD COLUMN `endsAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `MeetingEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `externalEventId` VARCHAR(150) NOT NULL,
    `meetingId` INTEGER NOT NULL,
    `status` ENUM('REQUESTED', 'CONFIRMED', 'CANCELED', 'COMPLETED') NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MeetingEvent_externalEventId_key`(`externalEventId`),
    INDEX `MeetingEvent_meetingId_occurredAt_idx`(`meetingId`, `occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Meeting_bookingKey_key` ON `Meeting`(`bookingKey`);

-- AddForeignKey
ALTER TABLE `MeetingEvent` ADD CONSTRAINT `MeetingEvent_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
