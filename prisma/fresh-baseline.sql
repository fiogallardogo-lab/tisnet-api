-- CreateTable
CREATE TABLE `Role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Role_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `roleId` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `acceptedTermsAt` DATETIME(3) NULL,
    `termsVersion` VARCHAR(50) NULL,
    `privacyVersion` VARCHAR(50) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `tokenVersion` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_roleId_isActive_idx`(`roleId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientProfile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `dni` VARCHAR(8) NULL,
    `age` INTEGER NULL,
    `phone` VARCHAR(20) NULL,
    `district` VARCHAR(100) NULL,
    `businessName` VARCHAR(150) NULL,
    `ruc` VARCHAR(11) NULL,
    `commercialName` VARCHAR(150) NULL,
    `businessDistrict` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ClientProfile_userId_key`(`userId`),
    UNIQUE INDEX `ClientProfile_dni_key`(`dni`),
    UNIQUE INDEX `ClientProfile_ruc_key`(`ruc`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeveloperProfile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `career` VARCHAR(150) NULL,
    `university` VARCHAR(180) NULL,
    `academicStatus` VARCHAR(100) NULL,
    `experienceYears` INTEGER NULL,
    `specialty` VARCHAR(120) NULL,
    `cvUrl` VARCHAR(500) NULL,
    `photoUrl` VARCHAR(500) NULL,
    `linkedinUrl` VARCHAR(500) NULL,
    `githubUrl` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DeveloperProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeveloperTechnology` (
    `developerProfileId` INTEGER NOT NULL,
    `technologyId` INTEGER NOT NULL,

    INDEX `DeveloperTechnology_technologyId_idx`(`technologyId`),
    PRIMARY KEY (`developerProfileId`, `technologyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductOwnerProfile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `bio` TEXT NULL,
    `specialty` VARCHAR(120) NULL,
    `availabilityNotes` VARCHAR(500) NULL,
    `photoUrl` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductOwnerProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminProfile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `executiveTitle` VARCHAR(120) NULL,
    `specialty` VARCHAR(120) NULL,
    `photoUrl` VARCHAR(500) NULL,
    `calendlyUrl` VARCHAR(500) NULL,
    `isPublicAdvisor` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AdminProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Quote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicCode` VARCHAR(20) NOT NULL,
    `status` ENUM('RECEIVED') NOT NULL DEFAULT 'RECEIVED',
    `solutionType` VARCHAR(64) NOT NULL,
    `contactName` VARCHAR(100) NOT NULL,
    `contactEmail` VARCHAR(150) NOT NULL,
    `contactPhone` VARCHAR(30) NOT NULL,
    `contactCompany` VARCHAR(150) NULL,
    `notes` TEXT NULL,
    `pricingStatus` ENUM('PENDING_RULES', 'CALCULATED') NOT NULL DEFAULT 'PENDING_RULES',
    `amountMinor` DECIMAL(15, 0) NULL,
    `currency` CHAR(3) NULL,
    `pricingVersion` VARCHAR(50) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deliveryMode` VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    `snapshot` JSON NULL,
    `legacyCode` VARCHAR(100) NULL,
    `legacyPublicQuoteId` INTEGER NULL,
    `activeVersion` INTEGER NOT NULL DEFAULT 0,
    `prospectId` INTEGER NULL,

    UNIQUE INDEX `Quote_publicCode_key`(`publicCode`),
    UNIQUE INDEX `Quote_legacyCode_key`(`legacyCode`),
    UNIQUE INDEX `Quote_legacyPublicQuoteId_key`(`legacyPublicQuoteId`),
    INDEX `Quote_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `Quote_pricingStatus_createdAt_idx`(`pricingStatus`, `createdAt`),
    INDEX `Quote_solutionType_createdAt_idx`(`solutionType`, `createdAt`),
    INDEX `Quote_prospectId_createdAt_idx`(`prospectId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Prospect` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `company` VARCHAR(150) NULL,
    `status` ENUM('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST') NOT NULL DEFAULT 'NEW',
    `source` ENUM('QUOTE', 'MEETING', 'MANUAL') NOT NULL DEFAULT 'QUOTE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Prospect_userId_key`(`userId`),
    UNIQUE INDEX `Prospect_email_key`(`email`),
    INDEX `Prospect_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `Prospect_source_createdAt_idx`(`source`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Meeting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `prospectId` INTEGER NOT NULL,
    `quoteId` INTEGER NULL,
    `advisorProfileId` INTEGER NULL,
    `status` ENUM('REQUESTED', 'CONFIRMED', 'CANCELED', 'COMPLETED') NOT NULL DEFAULT 'REQUESTED',
    `scheduledAt` DATETIME(3) NULL,
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'America/Lima',
    `notes` VARCHAR(1000) NULL,
    `endsAt` DATETIME(3) NULL,
    `bookingKey` VARCHAR(180) NULL,
    `externalProvider` VARCHAR(50) NULL,
    `externalEventUri` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Meeting_bookingKey_key`(`bookingKey`),
    UNIQUE INDEX `Meeting_externalEventUri_key`(`externalEventUri`),
    INDEX `Meeting_prospectId_createdAt_idx`(`prospectId`, `createdAt`),
    INDEX `Meeting_quoteId_idx`(`quoteId`),
    INDEX `Meeting_advisorProfileId_scheduledAt_idx`(`advisorProfileId`, `scheduledAt`),
    INDEX `Meeting_status_scheduledAt_idx`(`status`, `scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuoteOption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quoteId` INTEGER NOT NULL,
    `optionCode` VARCHAR(64) NOT NULL,
    `optionName` VARCHAR(150) NOT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuoteOption_quoteId_displayOrder_idx`(`quoteId`, `displayOrder`),
    UNIQUE INDEX `QuoteOption_quoteId_optionCode_key`(`quoteId`, `optionCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuoteItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quoteId` INTEGER NOT NULL,
    `itemCode` VARCHAR(64) NOT NULL,
    `label` VARCHAR(150) NOT NULL,
    `amountMinor` DECIMAL(15, 0) NOT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuoteItem_quoteId_displayOrder_idx`(`quoteId`, `displayOrder`),
    UNIQUE INDEX `QuoteItem_quoteId_itemCode_key`(`quoteId`, `itemCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Category_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Technology` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `icon` VARCHAR(255) NULL,
    `categoryId` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Technology_name_key`(`name`),
    INDEX `Technology_categoryId_idx`(`categoryId`),
    INDEX `Technology_isActive_categoryId_idx`(`isActive`, `categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

-- CreateTable
CREATE TABLE `Project` (
    `clientUserId` INTEGER NULL,
    `prospectId` INTEGER NULL,
    `productOwnerId` INTEGER NULL,
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(180) NOT NULL,
    `shortDescription` VARCHAR(300) NOT NULL,
    `description` TEXT NOT NULL,
    `problem` TEXT NULL,
    `solution` TEXT NULL,
    `objective` TEXT NULL,
    `features` JSON NULL,
    `categoryId` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'IN_DEVELOPMENT', 'IN_REVIEW', 'COMPLETED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `developmentDate` DATE NULL,
    `clientName` VARCHAR(150) NULL,
    `demoUrl` VARCHAR(500) NULL,
    `externalUrl` VARCHAR(500) NULL,
    `coverImageUrl` VARCHAR(500) NULL,
    `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `quoteId` INTEGER NULL,

    UNIQUE INDEX `Project_slug_key`(`slug`),
    UNIQUE INDEX `Project_quoteId_key`(`quoteId`),
    INDEX `Project_clientUserId_status_idx`(`clientUserId`, `status`),
    INDEX `Project_prospectId_idx`(`prospectId`),
    INDEX `Project_productOwnerId_status_idx`(`productOwnerId`, `status`),
    INDEX `Project_categoryId_idx`(`categoryId`),
    INDEX `Project_status_idx`(`status`),
    INDEX `Project_isPublished_displayOrder_idx`(`isPublished`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectMember` (
    `technicalRole` VARCHAR(80) NULL,
    `participationBasisPoints` INTEGER NOT NULL DEFAULT 0,
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `memberRole` ENUM('CLIENT', 'DEVELOPER', 'PRODUCT_OWNER') NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProjectMember_userId_isActive_idx`(`userId`, `isActive`),
    INDEX `ProjectMember_projectId_memberRole_isActive_idx`(`projectId`, `memberRole`, `isActive`),
    UNIQUE INDEX `ProjectMember_projectId_userId_key`(`projectId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectDeliverable` (
    `milestoneId` INTEGER NULL,
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `description` TEXT NOT NULL,
    `milestoneOrder` INTEGER NOT NULL,
    `dueDate` DATE NOT NULL,
    `status` ENUM('DRAFT', 'IN_REVIEW', 'APPROVED', 'OBSERVED') NOT NULL DEFAULT 'DRAFT',
    `fileUrl` VARCHAR(500) NULL,
    `externalLink` VARCHAR(500) NULL,
    `feedbackNotes` VARCHAR(2000) NULL,
    `submittedAt` DATETIME(3) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProjectDeliverable_milestoneId_idx`(`milestoneId`),
    INDEX `ProjectDeliverable_projectId_status_dueDate_idx`(`projectId`, `status`, `dueDate`),
    INDEX `ProjectDeliverable_reviewedById_idx`(`reviewedById`),
    UNIQUE INDEX `ProjectDeliverable_projectId_milestoneOrder_key`(`projectId`, `milestoneOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectTechnology` (
    `projectId` INTEGER NOT NULL,
    `technologyId` INTEGER NOT NULL,

    INDEX `ProjectTechnology_technologyId_idx`(`technologyId`),
    PRIMARY KEY (`projectId`, `technologyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Service` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(180) NOT NULL,
    `shortDescription` VARCHAR(300) NOT NULL,
    `description` TEXT NOT NULL,
    `icon` VARCHAR(100) NULL,
    `imageUrl` VARCHAR(500) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Service_slug_key`(`slug`),
    INDEX `Service_isActive_displayOrder_idx`(`isActive`, `displayOrder`),
    INDEX `Service_isFeatured_idx`(`isFeatured`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PublicQuote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(100) NOT NULL,
    `solutionType` VARCHAR(40) NOT NULL,
    `deliveryMode` VARCHAR(20) NOT NULL,
    `contact` JSON NOT NULL,
    `notes` TEXT NULL,
    `snapshot` JSON NOT NULL,
    `pricingStatus` VARCHAR(30) NOT NULL,
    `amountMinor` INTEGER NULL,
    `currency` VARCHAR(3) NULL,
    `pricingVersion` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PublicQuote_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeamApplication` (
    `resultingUserId` INTEGER NULL,
    `decidedByUserId` INTEGER NULL,
    `decidedAt` DATETIME(3) NULL,
    `interviewCompletedAt` DATETIME(3) NULL,
    `decisionReason` VARCHAR(1000) NULL,
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `dni` VARCHAR(8) NOT NULL,
    `requestedRole` ENUM('DEVELOPER', 'PRODUCT_OWNER') NOT NULL,
    `profile` JSON NOT NULL,
    `cv` LONGBLOB NOT NULL,
    `cvName` VARCHAR(255) NOT NULL,
    `photo` LONGBLOB NOT NULL,
    `photoMime` VARCHAR(30) NOT NULL,
    `consent` BOOLEAN NOT NULL,
    `status` ENUM('PENDING_REVIEW', 'INTERVIEW_ASSIGNED', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING_REVIEW',
    `assignedAdminProfileId` INTEGER NULL,
    `reviewedByUserId` INTEGER NULL,
    `interviewAssignedAt` DATETIME(3) NULL,
    `rejectionReason` VARCHAR(1000) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TeamApplication_code_key`(`code`),
    UNIQUE INDEX `TeamApplication_email_key`(`email`),
    UNIQUE INDEX `TeamApplication_dni_key`(`dni`),
    INDEX `TeamApplication_resultingUserId_idx`(`resultingUserId`),
    INDEX `TeamApplication_decidedByUserId_decidedAt_idx`(`decidedByUserId`, `decidedAt`),
    INDEX `TeamApplication_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `TeamApplication_requestedRole_status_createdAt_idx`(`requestedRole`, `status`, `createdAt`),
    INDEX `TeamApplication_assignedAdminProfileId_status_idx`(`assignedAdminProfileId`, `status`),
    INDEX `TeamApplication_reviewedByUserId_idx`(`reviewedByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuoteVersion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quoteId` INTEGER NOT NULL,
    `version` INTEGER NOT NULL,
    `clientUserId` INTEGER NOT NULL,
    `authorId` INTEGER NOT NULL,
    `observations` VARCHAR(2000) NULL,
    `amountMinor` DECIMAL(15, 0) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `scope` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `officialAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acceptedAt` DATETIME(3) NULL,
    `acceptedByUserId` INTEGER NULL,

    INDEX `QuoteVersion_clientUserId_createdAt_idx`(`clientUserId`, `createdAt`),
    INDEX `QuoteVersion_authorId_idx`(`authorId`),
    UNIQUE INDEX `QuoteVersion_quoteId_version_key`(`quoteId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentSchedule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quoteVersionId` INTEGER NOT NULL,
    `sequence` INTEGER NOT NULL,
    `percentageBasisPoints` INTEGER NOT NULL,
    `amountMinor` DECIMAL(15, 0) NOT NULL,
    `dueDate` DATE NOT NULL,
    `milestone` VARCHAR(150) NOT NULL,

    INDEX `PaymentSchedule_dueDate_idx`(`dueDate`),
    UNIQUE INDEX `PaymentSchedule_quoteVersionId_sequence_key`(`quoteVersionId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scheduleId` INTEGER NOT NULL,
    `externalEventId` VARCHAR(150) NOT NULL,
    `amountMinor` DECIMAL(15, 0) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `status` ENUM('CONFIRMED', 'FAILED') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Payment_externalEventId_key`(`externalEventId`),
    INDEX `Payment_scheduleId_status_idx`(`scheduleId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

-- CreateTable
CREATE TABLE `Kickoff` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `meetingId` INTEGER NULL,
    `actorId` INTEGER NOT NULL,
    `heldAt` DATETIME(3) NOT NULL,
    `notes` VARCHAR(2000) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Kickoff_projectId_key`(`projectId`),
    UNIQUE INDEX `Kickoff_meetingId_key`(`meetingId`),
    INDEX `Kickoff_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectMilestone` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `paymentScheduleId` INTEGER NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `dueDate` DATE NOT NULL,
    `sequence` INTEGER NOT NULL,

    UNIQUE INDEX `ProjectMilestone_paymentScheduleId_key`(`paymentScheduleId`),
    UNIQUE INDEX `ProjectMilestone_projectId_sequence_key`(`projectId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actorId` INTEGER NULL,
    `action` VARCHAR(100) NOT NULL,
    `entityType` VARCHAR(50) NOT NULL,
    `entityId` VARCHAR(100) NOT NULL,
    `metadata` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditEvent_entityType_createdAt_id_idx`(`entityType`, `createdAt`, `id`),
    INDEX `AuditEvent_actorId_createdAt_id_idx`(`actorId`, `createdAt`, `id`),
    INDEX `AuditEvent_createdAt_id_idx`(`createdAt`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuoteObservation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quoteId` INTEGER NOT NULL,
    `versionId` INTEGER NOT NULL,
    `authorId` INTEGER NOT NULL,
    `text` VARCHAR(2000) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuoteObservation_quoteId_createdAt_idx`(`quoteId`, `createdAt`),
    INDEX `QuoteObservation_versionId_idx`(`versionId`),
    INDEX `QuoteObservation_authorId_idx`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContactInquiry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `subject` VARCHAR(150) NOT NULL,
    `message` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ContactInquiry_code_key`(`code`),
    INDEX `ContactInquiry_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeliverableHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `deliverableId` INTEGER NOT NULL,
    `actorId` INTEGER NOT NULL,
    `action` ENUM('SUBMITTED', 'OBSERVED', 'APPROVED', 'EVIDENCE_UPDATED') NOT NULL,
    `fileUrl` VARCHAR(500) NULL,
    `externalLink` VARCHAR(500) NULL,
    `feedbackNotes` VARCHAR(2000) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DeliverableHistory_deliverableId_createdAt_idx`(`deliverableId`, `createdAt`),
    INDEX `DeliverableHistory_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MilestoneContribution` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `milestoneId` INTEGER NULL,
    `deliverableId` INTEGER NULL,
    `userId` INTEGER NOT NULL,
    `percentage` INTEGER NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MilestoneContribution_projectId_idx`(`projectId`),
    INDEX `MilestoneContribution_milestoneId_idx`(`milestoneId`),
    INDEX `MilestoneContribution_userId_idx`(`userId`),
    UNIQUE INDEX `MilestoneContribution_projectId_deliverableId_userId_key`(`projectId`, `deliverableId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

-- CreateTable
CREATE TABLE `WorkTask` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `description` VARCHAR(2000) NOT NULL,
    `status` ENUM('TODO', 'IN_PROGRESS', 'DONE') NOT NULL DEFAULT 'TODO',
    `assigneeId` INTEGER NULL,
    `createdById` INTEGER NOT NULL,
    `dueDate` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkTask_projectId_status_dueDate_idx`(`projectId`, `status`, `dueDate`),
    INDEX `WorkTask_assigneeId_status_idx`(`assigneeId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkResource` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `createdById` INTEGER NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkResource_projectId_createdAt_idx`(`projectId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `taskId` INTEGER NULL,
    `date` DATE NOT NULL,
    `minutes` INTEGER NOT NULL,
    `summary` VARCHAR(2000) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkLog_projectId_date_idx`(`projectId`, `date`),
    INDEX `WorkLog_userId_date_idx`(`userId`, `date`),
    INDEX `WorkLog_taskId_idx`(`taskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PrivateFile` (
    `id` VARCHAR(36) NOT NULL,
    `projectId` INTEGER NULL,
    `ownerId` INTEGER NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `storageKey` VARCHAR(255) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PrivateFile_storageKey_key`(`storageKey`),
    INDEX `PrivateFile_projectId_createdAt_idx`(`projectId`, `createdAt`),
    INDEX `PrivateFile_ownerId_kind_idx`(`ownerId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientProfile` ADD CONSTRAINT `ClientProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeveloperProfile` ADD CONSTRAINT `DeveloperProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeveloperTechnology` ADD CONSTRAINT `DeveloperTechnology_developerProfileId_fkey` FOREIGN KEY (`developerProfileId`) REFERENCES `DeveloperProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeveloperTechnology` ADD CONSTRAINT `DeveloperTechnology_technologyId_fkey` FOREIGN KEY (`technologyId`) REFERENCES `Technology`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductOwnerProfile` ADD CONSTRAINT `ProductOwnerProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminProfile` ADD CONSTRAINT `AdminProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_prospectId_fkey` FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Prospect` ADD CONSTRAINT `Prospect_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Meeting` ADD CONSTRAINT `Meeting_prospectId_fkey` FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Meeting` ADD CONSTRAINT `Meeting_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Meeting` ADD CONSTRAINT `Meeting_advisorProfileId_fkey` FOREIGN KEY (`advisorProfileId`) REFERENCES `AdminProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuoteOption` ADD CONSTRAINT `QuoteOption_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuoteItem` ADD CONSTRAINT `QuoteItem_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Technology` ADD CONSTRAINT `Technology_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `TechnologyCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_clientUserId_fkey` FOREIGN KEY (`clientUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_prospectId_fkey` FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_productOwnerId_fkey` FOREIGN KEY (`productOwnerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMember` ADD CONSTRAINT `ProjectMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectDeliverable` ADD CONSTRAINT `ProjectDeliverable_milestoneId_fkey` FOREIGN KEY (`milestoneId`) REFERENCES `ProjectMilestone`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectDeliverable` ADD CONSTRAINT `ProjectDeliverable_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectDeliverable` ADD CONSTRAINT `ProjectDeliverable_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectTechnology` ADD CONSTRAINT `ProjectTechnology_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectTechnology` ADD CONSTRAINT `ProjectTechnology_technologyId_fkey` FOREIGN KEY (`technologyId`) REFERENCES `Technology`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamApplication` ADD CONSTRAINT `TeamApplication_resultingUserId_fkey` FOREIGN KEY (`resultingUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamApplication` ADD CONSTRAINT `TeamApplication_decidedByUserId_fkey` FOREIGN KEY (`decidedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamApplication` ADD CONSTRAINT `TeamApplication_assignedAdminProfileId_fkey` FOREIGN KEY (`assignedAdminProfileId`) REFERENCES `AdminProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeamApplication` ADD CONSTRAINT `TeamApplication_reviewedByUserId_fkey` FOREIGN KEY (`reviewedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuoteVersion` ADD CONSTRAINT `QuoteVersion_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuoteVersion` ADD CONSTRAINT `QuoteVersion_clientUserId_fkey` FOREIGN KEY (`clientUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuoteVersion` ADD CONSTRAINT `QuoteVersion_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuoteVersion` ADD CONSTRAINT `QuoteVersion_acceptedByUserId_fkey` FOREIGN KEY (`acceptedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentSchedule` ADD CONSTRAINT `PaymentSchedule_quoteVersionId_fkey` FOREIGN KEY (`quoteVersionId`) REFERENCES `QuoteVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `PaymentSchedule`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MeetingEvent` ADD CONSTRAINT `MeetingEvent_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Kickoff` ADD CONSTRAINT `Kickoff_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `Meeting`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Kickoff` ADD CONSTRAINT `Kickoff_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Kickoff` ADD CONSTRAINT `Kickoff_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMilestone` ADD CONSTRAINT `ProjectMilestone_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectMilestone` ADD CONSTRAINT `ProjectMilestone_paymentScheduleId_fkey` FOREIGN KEY (`paymentScheduleId`) REFERENCES `PaymentSchedule`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuoteObservation` ADD CONSTRAINT `QuoteObservation_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuoteObservation` ADD CONSTRAINT `QuoteObservation_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `QuoteVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuoteObservation` ADD CONSTRAINT `QuoteObservation_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliverableHistory` ADD CONSTRAINT `DeliverableHistory_deliverableId_fkey` FOREIGN KEY (`deliverableId`) REFERENCES `ProjectDeliverable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliverableHistory` ADD CONSTRAINT `DeliverableHistory_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MilestoneContribution` ADD CONSTRAINT `MilestoneContribution_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MilestoneContribution` ADD CONSTRAINT `MilestoneContribution_milestoneId_fkey` FOREIGN KEY (`milestoneId`) REFERENCES `ProjectMilestone`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MilestoneContribution` ADD CONSTRAINT `MilestoneContribution_deliverableId_fkey` FOREIGN KEY (`deliverableId`) REFERENCES `ProjectDeliverable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MilestoneContribution` ADD CONSTRAINT `MilestoneContribution_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE `WorkTask` ADD CONSTRAINT `WorkTask_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkTask` ADD CONSTRAINT `WorkTask_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkTask` ADD CONSTRAINT `WorkTask_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkResource` ADD CONSTRAINT `WorkResource_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkResource` ADD CONSTRAINT `WorkResource_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkLog` ADD CONSTRAINT `WorkLog_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkLog` ADD CONSTRAINT `WorkLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkLog` ADD CONSTRAINT `WorkLog_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `WorkTask`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrivateFile` ADD CONSTRAINT `PrivateFile_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrivateFile` ADD CONSTRAINT `PrivateFile_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
