CREATE TABLE `shift_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workplace_id` integer NOT NULL,
	`name` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`hourly_rate` real,
	`daily_rate` real,
	`break_minutes` integer,
	`break_paid` integer,
	`night_rate_enabled` integer DEFAULT false NOT NULL,
	`night_multiplier` real,
	`night_start` text,
	`night_end` text,
	`holiday_rate_enabled` integer DEFAULT false NOT NULL,
	`holiday_percent` real,
	FOREIGN KEY (`workplace_id`) REFERENCES `workplaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`start_time` text,
	`end_time` text,
	`note` text,
	`shift_type_id` integer,
	`is_holiday` integer DEFAULT false NOT NULL,
	`is_rest_day` integer DEFAULT false NOT NULL,
	`manual_wage_override` real,
	`workplace_id` integer,
	`base_rate` real,
	`break_minutes` integer,
	`break_paid` integer,
	`night_rate_enabled` integer,
	`night_multiplier` real,
	`night_start` text,
	`night_end` text,
	`holiday_rate_enabled` integer,
	`holiday_percent` real,
	FOREIGN KEY (`shift_type_id`) REFERENCES `shift_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workplace_id`) REFERENCES `workplaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workplaces` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`wage_type` text NOT NULL,
	`monthly_salary` real,
	`onboard_date` text,
	`is_currently_employed` integer,
	`end_date` text,
	`default_hourly_rate` real,
	`default_daily_rate` real
);
