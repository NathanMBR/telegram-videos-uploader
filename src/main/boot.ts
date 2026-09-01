import { args } from '@/config'
import { DrizzleConnection } from '@/db'
import {
  ClackCLIService,
  // InquirerCLIService,
  PresetService
} from '@/services'
import {
  DeleteVideoUsecase,
  EditVideoUsecase,
  MenuUsecase,
  PrintPresetInfoUsecase,
  UploadVideosUsecase
} from '@/usecases'

export const boot = async () => {
  // const cliService = new InquirerCLIService()
  const cliService = new ClackCLIService()
  const presetsService = new PresetService()

  if (process.argv.length === 0) throw new Error()

  const presets = await presetsService.getAllPresets(args.presetsPath)

  const chosenPreset = await cliService.select({
    message: 'Select the preset you want:',
    options: presets.map(preset => ({ label: preset.name, value: preset }))
  })

  DrizzleConnection.databaseUrl = chosenPreset.databaseUrl
  await DrizzleConnection.runMigrations()

  const menuUsecase = new MenuUsecase(chosenPreset, cliService, [
    new PrintPresetInfoUsecase(chosenPreset, cliService),
    new UploadVideosUsecase(chosenPreset, cliService),
    new EditVideoUsecase(chosenPreset, cliService),
    new DeleteVideoUsecase(chosenPreset, cliService)
  ])

  const menuResult = await menuUsecase.execute()
  if (menuResult === 'PRESET') {
    await boot()
  }
}
