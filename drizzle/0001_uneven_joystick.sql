CREATE TABLE `connection` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`label` text NOT NULL,
	`base_url` text DEFAULT '' NOT NULL,
	`model` text,
	`config_json` text DEFAULT '{}' NOT NULL,
	`auth_scheme` text DEFAULT 'bearer' NOT NULL,
	`secret_ct` text,
	`secret_iv` text,
	`key_version` integer,
	`secret_last4` text,
	`status` text DEFAULT 'unchecked' NOT NULL,
	`last_checked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `connection_user_provider_idx` ON `connection` (`user_id`,`provider`);