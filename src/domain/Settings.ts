import { z as zod } from 'zod'

import { presetsSchema, targetUploadSizeInMB } from './Preset'

// const errorMessageSchema = 'settings'
const defaultTargetUploadSizeInMB = 1_792 // 1.75 GB in MB

export const settingsSchema = zod.object(
  {
    targetUploadSizeInMB: targetUploadSizeInMB.default(defaultTargetUploadSizeInMB),

    presets: presetsSchema
  },
  { error: 'Invalid settings object' }
)

export type Settings = zod.output<typeof settingsSchema>
