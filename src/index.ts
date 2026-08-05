import * as cli from '@inquirer/prompts'

import { args, loadPresets, logger } from '@/config'
import { DrizzleConnection } from '@/db'
import { uploadVideos } from '@/usecases'

const main = async (): Promise<number> => {
  try {
    const [presets, presetsError] = await loadPresets(args.presetsPath)
    if (!presets) {
      logger.error(presetsError.message)
      return 1
    }

    if (presets.length <= 0) {
      logger.error('Presets are empty. At least one preset is required to run.')
      return 1
    }

    const chosenPresetName = await cli.select({
      message: 'Select the preset you want:',
      choices: presets.map(preset => preset.name),
      loop: false
    })

    const chosenPreset = presets.find(preset => preset.name === chosenPresetName)
    if (!chosenPreset) {
      throw new Error('Unable to pick chosen preset')
    }

    DrizzleConnection.databaseUrl = chosenPreset.databaseUrl
    await DrizzleConnection.runMigrations()

    const chosenAction = await cli.select({
      message: 'Select the action you want:',
      choices: [
        {
          name: 'Upload videos',
          value: 'upload-videos'
        }
      ]
    })

    switch (chosenAction) {
      case 'upload-videos':
        await uploadVideos(chosenPreset)
        break

      default:
        throw new Error('Unexpected chosen action')
    }

    return 0
  } catch (error: unknown) {
    logger.fatal(error)

    return 1
  }
}

main()
  .then(exitCode => {
    process.exitCode = exitCode
  })
  .catch(error => logger.fatal(error))
  .finally(process.exit)
