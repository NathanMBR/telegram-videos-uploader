import { args } from '@/config'
import { DrizzleConnection } from '@/db'
import { InquirerCLIService, PresetService } from '@/services'
import {
  DeleteVideoUsecase,
  MenuUsecase,
  PrintPresetInfoUsecase,
  UploadVideosUsecase
} from '@/usecases'

export const boot = async () => {
  const cliService = new InquirerCLIService()
  const presetsService = new PresetService()

  const presets = await presetsService.getAllPresets(args.presetsPath)

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

  const menuResult = await menuUsecase.execute()
  if (menuResult === 'PRESET') {
    await boot()
  }
}
