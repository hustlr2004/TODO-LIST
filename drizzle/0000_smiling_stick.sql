CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`due_date` text,
	`priority` text DEFAULT 'Medium' NOT NULL,
	`category` text DEFAULT 'Personal' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reminder_at` text,
	`recurrence` text DEFAULT 'none' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_user_status` ON `tasks` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tasks_user_due_date` ON `tasks` (`user_id`,`due_date`);
