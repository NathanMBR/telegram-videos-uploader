import { type Preset, Usecase } from '@/domain'
import { type CLISelectContract, InquirerCLIService } from '@/services'

export class MenuUsecase extends Usecase {
  public readonly actionTitle = 'Select action'

  private readonly cliService: CLISelectContract
  constructor(
    public readonly preset: Preset,
    private readonly usecases: Array<Usecase>
  ) {
    super()

    this.cliService = new InquirerCLIService()
  }

  async execute() {
    const chosenAction = await this.cliService.select({
      message: 'Select the action you want:',
      options: this.usecases.map(usecase => ({
        label: usecase.actionTitle,
        value: usecase
      }))
    })

    await chosenAction.execute()
  }
}
