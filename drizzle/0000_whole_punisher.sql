CREATE TABLE `shifts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`wage_rule_id` integer NOT NULL,
	`note` text,
	FOREIGN KEY (`wage_rule_id`) REFERENCES `wage_rules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wage_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_name` text NOT NULL,
	`base_rate` real NOT NULL,
	`night_rate_enabled` integer DEFAULT false NOT NULL,
	`night_multiplier` real,
	`night_start` text,
	`night_end` text,
	`holiday_rate_enabled` integer DEFAULT false NOT NULL,
	`holiday_percent` real
);
