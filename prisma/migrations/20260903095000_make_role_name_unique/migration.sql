-- Authorization depends on role names being unique.
CREATE UNIQUE INDEX `Role_name_key` ON `Role`(`name`);
