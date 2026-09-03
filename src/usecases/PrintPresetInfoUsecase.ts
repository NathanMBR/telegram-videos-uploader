import { type Preset, Usecase } from '@/domain'
import { type CLIService, TelegramService } from '@/services'
import { getSeparator } from '@/utils'

export class PrintPresetInfoUsecase extends Usecase {
  public readonly actionTitle = 'Check preset data'

  private readonly telegramService: TelegramService

  constructor(
    protected readonly preset: Preset,
    private readonly cliService: CLIService
  ) {
    super()

    this.telegramService = new TelegramService({
      apiBaseUrl: preset.telegram.apiBaseUrl,
      botToken: preset.telegram.botToken
    })
  }

  async execute(): Promise<Usecase.ExecuteReturn> {
    const presetDataLoading = this.cliService.loading({
      loadingMessage: 'Loading preset data',
      doneMessage: 'Loading done!'
    })

    presetDataLoading.start()

    const healthCheckError = await this.telegramService.runHealthCheck()
    if (healthCheckError) {
      throw healthCheckError
    }

    const [telegramChatData, telegramBotSelfData] = await Promise.all([
      this.telegramService.getChatData({
        chatId: this.preset.telegram.channelId
      }),
      this.telegramService.getSelfData()
    ])

    presetDataLoading.stop()

    // Preset info
    const presetInfo = [
      getSeparator('PRESET'),
      `Name: ${this.preset.name}`,
      `Origin: ${this.preset.origin}`,
      `Database: ${this.preset.databaseUrl}`,
      `Videos directory: ${this.preset.videosDirectory}`,
      `Channel name: ${this.preset.postDescription.channel.name}`,
      `Channel url: ${this.preset.postDescription.channel.url}`,
      `Date format: ${this.preset.postDescription.dateFormat}`
    ].join('\n')

    this.cliService.print(presetInfo)

    // Telegram info
    const telegramInfo = [
      `\n${getSeparator('TELEGRAM')}`,
      `Channel title: ${telegramChatData.title}`,
      `Channel description: ${telegramChatData.description || '(empty)'}`,
      `Bot title: ${telegramBotSelfData.firstName} ${telegramBotSelfData.lastName || ''}`,
      `Bot username: @${telegramBotSelfData.username}`
    ].join('\n')

    this.cliService.print(telegramInfo)

    const shouldGoBack = await this.cliService.confirm({
      message: 'Return to menu?',
      default: true
    })

    return shouldGoBack ? 'MENU' : 'OK'
  }
}
