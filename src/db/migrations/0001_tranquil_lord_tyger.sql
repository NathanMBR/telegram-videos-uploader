PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_videos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deletedAt` integer,
	`title` text NOT NULL,
	`filename` text NOT NULL,
	`origin` text,
	`url` text,
	`status` text DEFAULT 'STORED_LOCALLY' NOT NULL,
	`availability` text DEFAULT 'UNKNOWN' NOT NULL,
	`publishedAt` integer,
	CONSTRAINT "availabilityCheck" CHECK("__new_videos"."availability" in ('UNKNOWN', 'PUBLIC', 'MEMBERS_ONLY', 'PRIVATE', 'UNLISTED', 'PREMIUM_ONLY', 'NEEDS_AUTH')),
	CONSTRAINT "status" CHECK("__new_videos"."status" in ('STORED_LOCALLY', 'UPLOADED'))
);
--> statement-breakpoint
INSERT INTO `__new_videos`("id", "createdAt", "updatedAt", "deletedAt", "title", "filename", "origin", "url", "status", "availability", "publishedAt") SELECT "id", "createdAt", "updatedAt", "deletedAt", "title", "filename", "origin", "url", "status", "availability", "publishedAt" FROM `videos`;--> statement-breakpoint
DROP TABLE `videos`;--> statement-breakpoint
ALTER TABLE `__new_videos` RENAME TO `videos`;--> statement-breakpoint
PRAGMA foreign_keys=ON;