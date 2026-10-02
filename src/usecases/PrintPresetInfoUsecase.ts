import { type Preset, Usecase } from '@/domain'
import { VideosRepository, VideoUploadsRepository } from '@/repositories'
import { type CLIService, TelegramService } from '@/services'
import { getSeparator } from '@/utils'

export class PrintPresetInfoUsecase extends Usecase {
  public readonly actionTitle = 'Check preset data'

  private readonly telegramService: TelegramService
  private readonly videosRepository: VideosRepository
  private readonly videoUploadsRepository: VideoUploadsRepository

  constructor(
    protected readonly preset: Preset,
    private readonly cliService: CLIService
  ) {
    super()

    this.telegramService = new TelegramService({
      apiBaseUrl: preset.telegram.apiBaseUrl,
      botToken: preset.telegram.botToken
    })

    this.videosRepository = new VideosRepository(this.preset.origin)
    this.videoUploadsRepository = new VideoUploadsRepository(this.preset.origin)
  }

  async execute(): Promise<Usecase.ExecuteReturn> {
    const healthCheckError = await this.telegramService.runHealthCheck()
    if (healthCheckError) {
      throw healthCheckError
    }

    const presetDataLoading = this.cliService.loading({
      loadingMessage: 'Loading preset data',
      doneMessage: 'Loading preset data done!'
    })

    presetDataLoading.start()

    const [
      telegramChatData,
      telegramBotSelfData,
      videosCount,
      videoUploadsCount,
      videoUploadsPartsCount
    ] = await Promise.all([
      this.telegramService.getChatData({
        chatId: this.preset.telegram.channelId
      }),
      this.telegramService.getSelfData(),
      this.videosRepository.count(),
      this.videoUploadsRepository.count(),
      this.videoUploadsRepository.countParts()
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

    this.cliService.printStep(presetInfo)

    // Telegram info
    const telegramInfo = [
      `\n${getSeparator('TELEGRAM')}`,
      `Channel title: ${telegramChatData.title}`,
      `Channel description: ${telegramChatData.description || '(empty)'}`,
      `Bot title: ${telegramBotSelfData.firstName} ${telegramBotSelfData.lastName || ''}`,
      `Bot username: @${telegramBotSelfData.username}`
    ].join('\n')

    this.cliService.printStep(telegramInfo)

    // Database info
    const databaseInfo = [
      `\n${getSeparator('DATABASE')}`,
      `Stored videos: ${videosCount}`,
      `Stored videos by quantity of parts:`,
      videoUploadsPartsCount
        .map(
          (partCount, index) =>
            // biome-ignore-start lint/style/noNonNullAssertion: checked previously
            `* With exactly ${partCount.part} part${index === 0 ? '' : 's'}: ${
              partCount.count -
              (videoUploadsPartsCount.length > index + 1
                ? videoUploadsPartsCount[index + 1]!.count
                : 0)
            }`
          // biome-ignore-end lint/style/noNonNullAssertion: checked previously
        )
        .join('\n'),
      '',
      `Stored video uploads: ${videoUploadsCount}`,
      `Stored video uploads by parts:`,
      videoUploadsPartsCount
        .map(partCount => `* Part ${partCount.part}: ${partCount.count}`)
        .join('\n')
    ].join('\n')

    this.cliService.printStep(databaseInfo)

    const shouldReturnToMenu = await this.cliService.confirm({
      message: 'Return to menu?',
      default: true
    })

    return shouldReturnToMenu ? 'MENU' : 'OK'
  }
}
