import { args, logger } from '@/config'
import { DrizzleConnection } from '@/db'
import { InquirerCLIService, PresetService } from '@/services'
import {
  DeleteVideoUsecase,
  MenuUsecase,
  PrintPresetInfoUsecase,
  UploadVideosUsecase
} from '@/usecases'

const main = async (): Promise<number> => {
  try {
    const cliService = new InquirerCLIService()
    const presetsService = new PresetService()

    const [presets, presetsError] = await presetsService.getAllPresets(args.presetsPath)
    if (!presets) {
      logger.error(presetsError.message)
      return 1
    }

    if (presets.length <= 0) {
      logger.error('Presets are empty. At least one preset is required to run.')
      return 1
    }

    const chosenPreset = await cliService.select({
      message: 'Select the preset you want:',
      options: presets.map(preset => ({ label: preset.name, value: preset }))
    })

    DrizzleConnection.databaseUrl = chosenPreset.databaseUrl
    await DrizzleConnection.runMigrations()

    const menuUsecase = new MenuUsecase(chosenPreset, [
      new UploadVideosUsecase(chosenPreset),
      new DeleteVideoUsecase(chosenPreset),
      new PrintPresetInfoUsecase(chosenPreset)
    ])

    await menuUsecase.execute()

    return 0
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      return 0
    }

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
