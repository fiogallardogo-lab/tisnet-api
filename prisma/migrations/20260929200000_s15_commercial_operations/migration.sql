-- CreateTable
CREATE TABLE `PaymentReminder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scheduleId` INTEGER NOT NULL,
    `deliverableId` INTEGER NOT NULL,
    `trigger` VARCHAR(20) NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `dueAt` DATETIME(3) NOT NULL,
    `calendarVersion` VARCHAR(100) NOT NULL,
    `cutoff` VARCHAR(5) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PaymentReminder_scheduleId_key`(`scheduleId`),
    INDEX `PaymentReminder_dueAt_idx`(`dueAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentReminderDelivery` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reminderId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `audience` VARCHAR(10) NOT NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `nextAttemptAt` DATETIME(3) NOT NULL,
    `leaseUntil` DATETIME(3) NULL,
    `claimToken` VARCHAR(36) NULL,
    `sentAt` DATETIME(3) NULL,
    `messageId` VARCHAR(255) NULL,
    `lastErrorCode` VARCHAR(50) NULL,

    INDEX `PaymentReminderDelivery_status_nextAttemptAt_leaseUntil_idx`(`status`, `nextAttemptAt`, `leaseUntil`),
    UNIQUE INDEX `PaymentReminderDelivery_reminderId_userId_key`(`reminderId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PublicTeamProfile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `displayName` VARCHAR(100) NOT NULL,
    `biography` VARCHAR(1000) NOT NULL,
    `specialty` VARCHAR(150) NOT NULL,
    `photoUrl` VARCHAR(500) NULL,
    `approved` BOOLEAN NOT NULL DEFAULT false,
    `consentRecorded` BOOLEAN NOT NULL DEFAULT false,
    `approvedById` INTEGER NOT NULL,
    `approvedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PublicTeamProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PaymentReminder` ADD CONSTRAINT `PaymentReminder_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `PaymentSchedule`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentReminder` ADD CONSTRAINT `PaymentReminder_deliverableId_fkey` FOREIGN KEY (`deliverableId`) REFERENCES `ProjectDeliverable`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentReminderDelivery` ADD CONSTRAINT `PaymentReminderDelivery_reminderId_fkey` FOREIGN KEY (`reminderId`) REFERENCES `PaymentReminder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentReminderDelivery` ADD CONSTRAINT `PaymentReminderDelivery_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PublicTeamProfile` ADD CONSTRAINT `PublicTeamProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

