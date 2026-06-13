import { type InferInsertModel, type InferSelectModel, sql } from 'drizzle-orm'
import { check, int, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const videoAvailabilities = [
  'UNKNOWN',
  'PUBLIC',
  'MEMBERS_ONLY',
  'PRIVATE',
  'UNLISTED',
  'PREMIUM_ONLY',
  'NEEDS_AUTH'
] as const
export type VideoAvailabilities = (typeof videoAvailabilities)[number]
export const defaultVideoAvailability = 'UNKNOWN' satisfies VideoAvailabilities
const availabilityCheck = sql.raw(
  `(${videoAvailabilities.map(availability => `'${availability}'`).join(', ')})`
)

export const videoStatuses = ['STORED_LOCALLY', 'UPLOADED'] as const
export type VideoStatuses = (typeof videoStatuses)[number]
const defaultVideoStatus = 'STORED_LOCALLY' satisfies VideoStatuses
export const statusCheck = sql.raw(`(${videoStatuses.map(status => `'${status}'`).join(', ')})`)

const unixepoch = sql`(unixepoch() * 1000)`

export const videosTable = sqliteTable(
  'videos',
  {
    id: int().primaryKey({ autoIncrement: true }),
    createdAt: int('createdAt', { mode: 'timestamp_ms' }).notNull().default(unixepoch),
    updatedAt: int('updatedAt', { mode: 'timestamp_ms' }).notNull().default(unixepoch),
    deletedAt: int('deletedAt', { mode: 'timestamp_ms' }),

    title: text().notNull(),
    filename: text().notNull(),
    origin: text(),
    url: text(),
    status: text('status', { enum: videoStatuses }).notNull().default(defaultVideoStatus),
    availability: text('availability', { enum: videoAvailabilities })
      .notNull()
      .default(defaultVideoAvailability),

    publishedAt: int('publishedAt', { mode: 'timestamp_ms' })
  },
  videosTable => [
    check('availabilityCheck', sql`${videosTable.availability} in ${availabilityCheck}`),

    check('status', sql`${videosTable.status} in ${statusCheck}`)
  ]
)

export type NewVideo = InferInsertModel<typeof videosTable>
export type Video = InferSelectModel<typeof videosTable>
