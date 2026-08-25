import fs from 'node:fs/promises'

import { type Presets, presetsSchema } from '@/domain'
import { ImplementationError, UsageError } from '@/errors'
import { checkPathAccessibility } from '@/utils'

export type LoadPresetsResult = Promise<Presets>
export class PresetService {
  async getAllPresets(presetsPath: string): LoadPresetsResult {
    const presetsAccessibility = await checkPathAccessibility(presetsPath)
    if (presetsAccessibility === 'INEXISTENT') {
      throw new UsageError(`Presets file at "${presetsPath}" not found`)
    }

    if (presetsAccessibility === 'UNACCESSIBLE') {
      throw new UsageError(`Presets file at "${presetsPath}" isn't accessible`)
    }

    const jsonDataBuffer = await fs.readFile(presetsPath)

    const jsonData = JSON.parse(jsonDataBuffer.toString())

    const presetsValidationResult = presetsSchema.safeParse(jsonData)
    if (!presetsValidationResult.success) {
      const [issue] = presetsValidationResult.error.issues
      if (!issue) {
        throw new ImplementationError('Unexpected presetsSchema validation error')
      }

      throw new UsageError(issue.message)
    }

    if (presetsValidationResult.data.length <= 0) {
      throw new UsageError(
        `Presets file at "${presetsPath}" is empty (at least one preset is required)`
      )
    }

    return presetsValidationResult.data
  }
}
