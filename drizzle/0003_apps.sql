CREATE TABLE `app` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`tagline` text DEFAULT '' NOT NULL,
	`description` text,
	`icon` text DEFAULT '✳️' NOT NULL,
	`accent` text DEFAULT 'violet' NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`blueprint_json` text NOT NULL,
	`draft_revision` integer DEFAULT 1 NOT NULL,
	`published_version_id` text,
	`visibility` text DEFAULT 'draft' NOT NULL,
	`remixed_from_app_id` text,
	`remixed_from_version_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`published_at` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_slug_unique` ON `app` (`slug`);--> statement-breakpoint
CREATE INDEX `app_owner_idx` ON `app` (`owner_id`);--> statement-breakpoint
CREATE INDEX `app_visibility_published_idx` ON `app` (`visibility`,`published_at`);--> statement-breakpoint
CREATE INDEX `app_published_version_idx` ON `app` (`published_version_id`);--> statement-breakpoint
CREATE TABLE `app_version` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`version` integer NOT NULL,
	`blueprint_json` text NOT NULL,
	`changelog` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `app`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_version_app_version_idx` ON `app_version` (`app_id`,`version`);--> statement-breakpoint
CREATE INDEX `app_version_app_idx` ON `app_version` (`app_id`);