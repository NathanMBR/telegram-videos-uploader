import { sql } from 'drizzle-orm'

export const unixepoch = sql`(unixepoch() * 1000)`
