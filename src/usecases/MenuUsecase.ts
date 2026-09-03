import { type Preset, Usecase } from '@/domain'
import type { CLIService } from '@/services'

export class MenuUsecase extends Usecase {
  public readonly actionTitle = 'Select action'

  constructor(
    protected readonly preset: Preset,
    private readonly cliService: CLIService,
    private readonly usecases: Array<Usecase>
  ) {
    super()
  }

  async execute(): Promise<Usecase.ExecuteReturn> {
    const options = this.usecases.map(usecase => ({
      label: usecase.actionTitle,
      value: async () => await usecase.execute()
    }))

    const changePresetOption = {
      label: 'Change preset',
      value: async () => 'PRESET' as const
    }

    const exitOption = {
      label: 'Exit',
      value: async () => 'OK' as const
    } as const

    options.push(changePresetOption)
    options.push(exitOption)

    const chosenAction = await this.cliService.select({
      message: 'Select the action you want:',
      options
    })

    const chosenActionResult = await chosenAction()
    if (chosenActionResult === 'MENU') {
      return await this.execute()
    }

    return chosenActionResult
  }
}
