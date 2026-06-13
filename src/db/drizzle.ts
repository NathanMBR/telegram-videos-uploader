import { drizzle as drizzleInit } from 'drizzle-orm/libsql'

import { DB_FILE } from '../config'

export const drizzle = drizzleInit({
  connection: {
    url: DB_FILE
  }
})
