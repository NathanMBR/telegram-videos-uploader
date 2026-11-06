import { z as zod } from 'zod'

// import { getSchemaErrorMessage } from './core'
import { presetsSchema } from './Preset'

// const errorMessageSchema = 'settings'

export const settingsSchema = zod.object(
  {
    presets: presetsSchema
  },
  { error: 'Invalid settings object' }
)

export type Settings = zod.output<typeof settingsSchema>
