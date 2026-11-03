CREATE TABLE `usage_daily` (
	`subject` text NOT NULL,
	`day` text NOT NULL,
	`runs` integer DEFAULT 0 NOT NULL,
	`tokens` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`subject`, `day`)
);
