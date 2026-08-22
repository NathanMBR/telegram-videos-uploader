import fs from 'node:fs/promises'

import { type Presets, presetsSchema } from '@/domain'
import { checkPathAccessibility } from '@/utils'

type LoadPresetsSuccessResult = [Presets, null]
type LoadPresetsFailureResult = [null, Error]
export type LoadPresetsResult = Promise<LoadPresetsSuccessResult | LoadPresetsFailureResult>
export class PresetService {
  async getAllPresets(presetsPath: string) {
    const presetsAccessibility = await checkPathAccessibility(presetsPath)
    if (presetsAccessibility === 'INEXISTENT') {
      return [null, new Error(`Presets file at "${presetsPath}" not found`)] as const
    }

    if (presetsAccessibility === 'UNACCESSIBLE') {
      return [null, new Error(`Presets path "${presetsPath}" isn't accessible`)] as const
    }

    const jsonDataBuffer = await fs.readFile(presetsPath)

    const jsonData = JSON.parse(jsonDataBuffer.toString())

    const presetsValidationResult = presetsSchema.safeParse(jsonData)
    if (!presetsValidationResult.success) {
      const [issue] = presetsValidationResult.error.issues
      if (!issue) {
        throw new Error('Unexpected presetsSchema validation error')
      }

      return [null, new Error(issue.message)] as const
    }

    return [presetsValidationResult.data, null] as const
  }
}
