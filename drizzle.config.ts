import { defineConfig } from 'drizzle-kit'

import { DrizzleConnection } from './src/db'

export default defineConfig({
  out: DrizzleConnection.migrationsFolder,
  schema: DrizzleConnection.schemasFile,
  dialect: 'sqlite',
  dbCredentials: {
    // biome-ignore lint/style/noNonNullAssertion: unnecessary in drizzle config file
    url: process.env.DB_FILE!
  }
})
