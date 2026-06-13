CREATE TABLE `videos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deletedAt` integer,
	`title` text NOT NULL,
	`filename` text NOT NULL,
	`origin` text,
	`url` text,
	`availability` text NOT NULL,
	`status` text DEFAULT 'STORED_LOCALLY' NOT NULL,
	`publishedAt` integer NOT NULL,
	CONSTRAINT "availabilityCheck" CHECK("videos"."availability" in ('PUBLIC', 'MEMBERS_ONLY', 'PRIVATE', 'UNLISTED', 'PREMIUM_ONLY', 'NEEDS_AUTH')),
	CONSTRAINT "status" CHECK("videos"."status" in ('STORED_LOCALLY', 'UPLOADED'))
);
