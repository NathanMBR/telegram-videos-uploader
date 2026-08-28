import { type Preset, Usecase } from '@/domain'
import { UsageError } from '@/errors'
import {
  type CLIConfirmContract,
  type CLIPrintContract,
  InquirerCLIService,
  TelegramService
} from '@/services'
import { getSeparator } from '@/utils'

export class PrintPresetInfoUsecase extends Usecase {
  public readonly actionTitle = 'Check preset data'

  public readonly telegramService: TelegramService
  public readonly cliService: CLIConfirmContract & CLIPrintContract

  constructor(public readonly preset: Preset) {
    super()

    this.telegramService = new TelegramService({
      apiBaseUrl: preset.telegram.apiBaseUrl,
      botToken: preset.telegram.botToken
    })

    this.cliService = new InquirerCLIService()
  }

  async execute(): Promise<Usecase.ExecuteReturn> {
    const isApiAvailable = await this.telegramService.runHealthCheck()
    if (!isApiAvailable) {
      throw new UsageError(`Could not connect to API at "${this.preset.telegram.apiBaseUrl}"`)
    }

    const telegramChatData = await this.telegramService.getChatData({
      chatId: this.preset.telegram.channelId
    })

    const telegramBotSelfData = await this.telegramService.getSelfData()

    // Preset info
    this.cliService.print(getSeparator('PRESET'))
    this.cliService.print(`Name: ${this.preset.name}`)
    this.cliService.print(`Origin: ${this.preset.origin}`)
    this.cliService.print(`Database: ${this.preset.databaseUrl}`)
    this.cliService.print(`Videos directory: ${this.preset.videosDirectory}`)
    this.cliService.print(`Channel name: ${this.preset.postDescription.channel.name}`)
    this.cliService.print(`Channel url: ${this.preset.postDescription.channel.url}`)
    this.cliService.print(`Date format: ${this.preset.postDescription.dateFormat}`)

    // Telegram info
    this.cliService.print(`\n${getSeparator('TELEGRAM')}`)
    this.cliService.print(`Channel title: ${telegramChatData.title}`)

    if (telegramChatData.description) {
      this.cliService.print(`Channel description: ${telegramChatData.description}`)
    }

    this.cliService.print(
      `Bot title: ${telegramBotSelfData.firstName} ${telegramBotSelfData.lastName || ''}`
    )
    this.cliService.print(`Bot username: @${telegramBotSelfData.username}`)

    const shouldGoBack = await this.cliService.confirm({
      message: 'Return to menu?',
      default: true
    })

    return shouldGoBack ? 'MENU' : 'OK'
  }
}
