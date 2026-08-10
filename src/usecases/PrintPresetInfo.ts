import { stepsLogger } from '@/config'
import type { Preset, Usecase } from '@/domain'
import { TelegramService } from '@/services'
import { getSeparator } from '@/utils'

export class PrintPresetInfo implements Usecase {
  constructor(public readonly preset: Preset) {}

  async execute() {
    const telegramService = new TelegramService({
      apiBaseUrl: this.preset.telegram.apiBaseUrl,
      botToken: this.preset.telegram.botToken
    })

    const isApiAvailable = await telegramService.runHealthCheck()
    if (!isApiAvailable) {
      throw new Error(`Could not connect to API at "${this.preset.telegram.apiBaseUrl}"`)
    }

    const telegramChatData = await telegramService.getChatData(this.preset.telegram.channelId)
    const telegramBotSelfData = await telegramService.getSelfData()

    stepsLogger.info(getSeparator('PRESET'))
    stepsLogger.info(`Name: ${this.preset.name}`)
    stepsLogger.info(`Origin: ${this.preset.origin}`)
    stepsLogger.info(`Database: ${this.preset.databaseUrl}`)
    stepsLogger.info(`Videos directory: ${this.preset.videosDirectory}`)
    stepsLogger.info(`Channel name: ${this.preset.postDescription.channel.name}`)
    stepsLogger.info(`Channel url: ${this.preset.postDescription.channel.url}`)
    stepsLogger.info(`Date format: ${this.preset.postDescription.dateFormat}`)

    stepsLogger.info(`\n${getSeparator('TELEGRAM')}`)
    stepsLogger.info(`Channel title: ${telegramChatData.title}`)

    if (telegramChatData.description) {
      stepsLogger.info(`Channel description: ${telegramChatData.description}`)
    }

    stepsLogger.info(
      `Bot title: ${telegramBotSelfData.firstName} ${telegramBotSelfData.lastName || ''}`
    )
    stepsLogger.info(`Bot username: @${telegramBotSelfData.username}`)
  }
}
