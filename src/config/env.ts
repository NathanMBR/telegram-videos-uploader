import { z as zod } from 'zod'

export const DB_FILE = zod
  .string({ error: 'Missing required DB_FILE env' })
  .trim()
  .parse(process.env.DB_FILE)
