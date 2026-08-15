CREATE TABLE `videoUploads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`videoId` integer NOT NULL,
	`telegramPostId` integer NOT NULL,
	`partIndex` integer NOT NULL,
	`uploadedAt` integer NOT NULL,
	FOREIGN KEY (`videoId`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `videoUploads_telegramPostId_unique` ON `videoUploads` (`telegramPostId`);--> statement-breakpoint
ALTER TABLE `videos` DROP COLUMN `deletedAt`;