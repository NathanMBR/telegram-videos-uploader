import { relations } from 'drizzle-orm'

import { videosTable } from './videosTable'
import { videoUploadsTable } from './videoUploadsTable'

export const videosTableRelations = relations(videosTable, ({ many }) => ({
  uploads: many(videoUploadsTable)
}))

export const videoUploadsTableRelations = relations(videoUploadsTable, ({ one }) => ({
  video: one(videosTable, {
    fields: [videoUploadsTable.videoId],
    references: [videosTable.id]
  })
}))
