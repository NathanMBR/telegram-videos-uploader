import { args } from '@/config'
import { DrizzleConnection } from '@/db'
import { ClackCLIService, SettingsService } from '@/services'
import {
  DeleteVideoUsecase,
  EditVideoUsecase,
  MenuUsecase,
  PrintPresetInfoUsecase,
  PrintVideoInfoUsecase,
  PrintVideosByAvailabilityUsecase,
  UploadVideosUsecase
} from '@/usecases'

export const boot = async () => {
  const { settingsPath } = args

  const cliService = new ClackCLIService()
  const settingsService = new SettingsService()

  if (process.argv.length === 0) throw new Error()

  const settings = await settingsService.load({ settingsPath })

  const chosenPreset = await cliService.select({
    message: 'Select the preset you want:',
    options: settings.presets.map(preset => ({ label: preset.name, value: preset }))
  })

  DrizzleConnection.databaseUrl = chosenPreset.databaseUrl
  await DrizzleConnection.runMigrations()

  const menuUsecase = new MenuUsecase(chosenPreset, cliService, [
    new PrintPresetInfoUsecase(chosenPreset, cliService),
    new PrintVideoInfoUsecase(chosenPreset, cliService),
    new PrintVideosByAvailabilityUsecase(chosenPreset, cliService),
    new UploadVideosUsecase(chosenPreset, cliService),
    new EditVideoUsecase(chosenPreset, cliService),
    new DeleteVideoUsecase(chosenPreset, cliService)
  ])

  const menuResult = await menuUsecase.execute()
  if (menuResult === 'PRESET') {
    // biome-ignore lint/suspicious/noConsole: easiest way to clear the screen
    console.clear()

    await boot()
  }
}
