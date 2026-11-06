import fs from 'node:fs/promises'

import { type Settings, settingsSchema } from '@/domain'
import { ImplementationError, UsageError } from '@/errors'
import { checkPathAccessibility } from '@/utils'

export namespace SettingsService {
  export namespace Load {
    export type DTO = {
      settingsPath: string
    }

    export type Result = Promise<Settings>
  }
}

export class SettingsService {
  async load(dto: SettingsService.Load.DTO): SettingsService.Load.Result {
    const { settingsPath } = dto

    const settingsPathAccessibility = await checkPathAccessibility(settingsPath)
    if (settingsPathAccessibility === 'INEXISTENT') {
      throw new UsageError(`Settings file at "${settingsPath}" not found`)
    }

    if (settingsPathAccessibility === 'UNACCESSIBLE') {
      throw new UsageError(`Settings file at "${settingsPath}" isn't accessible`)
    }

    const jsonDataBuffer = await fs.readFile(settingsPath)
    const jsonData = JSON.parse(jsonDataBuffer.toString())

    const settingsValidationResult = settingsSchema.safeParse(jsonData)
    if (!settingsValidationResult.success) {
      const [issue] = settingsValidationResult.error.issues
      if (!issue) {
        throw new ImplementationError('Unexpected settingsSchema validation error')
      }

      throw new UsageError(issue.message)
    }

    const settings = settingsValidationResult.data
    if (settings.presets.length <= 0) {
      throw new UsageError(
        `Settings file at "${settingsPath}" has no presets (at least one is required)`
      )
    }

    return settingsValidationResult.data
  }
}
