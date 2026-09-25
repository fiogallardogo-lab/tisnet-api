-- Preserve the original PublicQuote table as a read-only archive. Never reprice history.
-- Deterministic migration codes contain leading zeroes (outside random code alphabet).
INSERT INTO `Prospect` (`name`,`email`,`phone`,`company`,`source`,`status`,`createdAt`,`updatedAt`)
SELECT MIN(JSON_UNQUOTE(JSON_EXTRACT(`contact`,'$.fullName'))), LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(`contact`,'$.email')))), MIN(JSON_UNQUOTE(JSON_EXTRACT(`contact`,'$.phone'))), MIN(JSON_UNQUOTE(JSON_EXTRACT(`contact`,'$.company'))), 'QUOTE','NEW',MIN(`createdAt`),CURRENT_TIMESTAMP(3)
FROM `PublicQuote` GROUP BY LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(`contact`,'$.email'))))
ON DUPLICATE KEY UPDATE `id`=`Prospect`.`id`;
INSERT INTO `Quote` (`publicCode`,`legacyCode`,`legacyPublicQuoteId`,`status`,`solutionType`,`contactName`,`contactEmail`,`contactPhone`,`contactCompany`,`notes`,`pricingStatus`,`amountMinor`,`currency`,`pricingVersion`,`createdAt`,`updatedAt`,`prospectId`,`deliveryMode`,`snapshot`)
SELECT CONCAT('Q-',LPAD(UPPER(CONV(p.`id`,10,36)),8,'0')),p.`code`,p.`id`,'RECEIVED',p.`solutionType`,JSON_UNQUOTE(JSON_EXTRACT(p.`contact`,'$.fullName')),LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(p.`contact`,'$.email')))),JSON_UNQUOTE(JSON_EXTRACT(p.`contact`,'$.phone')),NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.`contact`,'$.company')),'null'),p.`notes`,p.`pricingStatus`,p.`amountMinor`,p.`currency`,p.`pricingVersion`,p.`createdAt`,p.`createdAt`,r.`id`,p.`deliveryMode`,p.`snapshot`
FROM `PublicQuote` p JOIN `Prospect` r ON r.`email`=LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(p.`contact`,'$.email'))))
WHERE NOT EXISTS (SELECT 1 FROM `Quote` q WHERE q.`legacyPublicQuoteId`=p.`id`);
INSERT INTO `QuoteItem` (`quoteId`,`itemCode`,`label`,`amountMinor`,`displayOrder`,`createdAt`)
SELECT q.`id`, CONCAT('MIGRATED_',j.n),j.code,j.amount,j.n,q.`createdAt`
FROM `Quote` q JOIN JSON_TABLE(q.`snapshot`,'$.lines[*]' COLUMNS(n FOR ORDINALITY,code VARCHAR(150) PATH '$.code',amount DECIMAL(15,0) PATH '$.amountMinor')) j
WHERE q.`legacyPublicQuoteId` IS NOT NULL;
-- Backfill canonical quotes that predate automatic Prospect association.
INSERT INTO `Prospect` (`name`,`email`,`phone`,`company`,`source`,`status`,`createdAt`,`updatedAt`)
SELECT MIN(`contactName`),LOWER(TRIM(`contactEmail`)),MIN(`contactPhone`),MIN(`contactCompany`),'QUOTE','NEW',MIN(`createdAt`),CURRENT_TIMESTAMP(3)
FROM `Quote` GROUP BY LOWER(TRIM(`contactEmail`)) ON DUPLICATE KEY UPDATE `id`=`Prospect`.`id`;
UPDATE `Quote` q JOIN `Prospect` p ON p.`email`=LOWER(TRIM(q.`contactEmail`)) SET q.`prospectId`=p.`id` WHERE q.`prospectId` IS NULL;
