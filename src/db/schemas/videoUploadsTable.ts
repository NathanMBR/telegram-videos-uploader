import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { int, sqliteTable, unique } from 'drizzle-orm/sqlite-core'

import { unixepoch } from './core'
import { videosTable } from './videosTable'

export const videoUploadsTable = sqliteTable(
  'videoUploads',
  {
    id: int().primaryKey({ autoIncrement: true }),
    createdAt: int('createdAt', { mode: 'timestamp_ms' }).notNull().default(unixepoch),
    updatedAt: int('updatedAt', { mode: 'timestamp_ms' })
      .notNull()
      .default(unixepoch)
      .$onUpdate(() => new Date()),

    videoId: int()
      .notNull()
      .references(() => videosTable.id, { onDelete: 'cascade' }),

    telegramPostId: int().notNull().unique(),
    part: int().notNull(),
    uploadedAt: int('uploadedAt', { mode: 'timestamp_ms' }).notNull()
  },
  table => [unique('videoId_part_unique').on(table.videoId, table.part)]
)

export type VideoUpload = InferSelectModel<typeof videoUploadsTable>
export namespace VideoUpload {
  export type New = InferInsertModel<typeof videoUploadsTable>
}
