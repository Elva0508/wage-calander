CREATE TABLE `report_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`range_type` text NOT NULL,
	`workplace_ids` text,
	`show_split` integer DEFAULT true NOT NULL,
	`show_breakdown` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE `workplaces` ADD `pay_cycle` text;--> statement-breakpoint
ALTER TABLE `workplaces` ADD `payday_day_of_month` integer;--> statement-breakpoint
ALTER TABLE `workplaces` ADD `payday_weekday` integer;--> statement-breakpoint
ALTER TABLE `workplaces` ADD `period_start_day_of_month` integer;--> statement-breakpoint
ALTER TABLE `workplaces` ADD `period_start_weekday` integer;--> statement-breakpoint
ALTER TABLE `workplaces` ADD `period_end_day_of_month` integer;--> statement-breakpoint
ALTER TABLE `workplaces` ADD `period_end_is_end_of_month` integer;--> statement-breakpoint
ALTER TABLE `workplaces` ADD `period_end_weekday` integer;