import { args } from '@/config'
import { type Preset, Usecase } from '@/domain'
import { ImplementationError } from '@/errors'
import { VideosRepository, VideoUploadsRepository } from '@/repositories'
import { type CLIService, TelegramService } from '@/services'

export class DeleteVideoUsecase extends Usecase {
  public readonly actionTitle = 'Delete video'

  private readonly videosRepository: VideosRepository
  private readonly videoUploadsRepository: VideoUploadsRepository

  private readonly telegramService: TelegramService

  constructor(
    protected readonly preset: Preset,
    private readonly cliService: CLIService
  ) {
    super()

    this.videosRepository = new VideosRepository()
    this.videoUploadsRepository = new VideoUploadsRepository()

    this.telegramService = new TelegramService({
      apiBaseUrl: preset.telegram.apiBaseUrl,
      botToken: preset.telegram.botToken
    })
  }

  public async execute(): Promise<Usecase.ExecuteReturn> {
    const healthCheckError = await this.telegramService.runHealthCheck()
    if (healthCheckError) {
      throw healthCheckError
    }

    const selectedVideo = await this.cliService.autocomplete({
      message: 'Select the video to remove:',
      getOptions: async input => {
        const videos = await this.videosRepository.getAll(input || '', this.preset.origin)

        const options = videos.map(video => ({
          label: video.title,
          value: video
        }))

        return options
      }
    })

    const deleteConfirmation = await this.cliService.confirm({
      message: 'Are you sure you want to delete?',
      default: false
    })

    if (!deleteConfirmation) {
      this.cliService.printError('Deletion cancelled.')
      return 'MENU'
    }

    const videoUploads = await this.videoUploadsRepository.getAll(selectedVideo.id)

    const [firstVideoUpload] = videoUploads
    if (!firstVideoUpload) {
      throw new ImplementationError('Undefined firstVideoUpload')
    }

    const twoDaysInMilliseconds = 1_000 * 60 * 60 * 24 * 2

    const isUploadOlderThanTwoDays =
      firstVideoUpload.uploadedAt.getTime() + twoDaysInMilliseconds <= Date.now()

    if (isUploadOlderThanTwoDays) {
      this.cliService.printError(
        `Telegram doesn't allow to delete a message older than two days through API`
      )

      const shouldDeleteOnlyFromDatabase = await this.cliService.confirm({
        message: 'Delete ONLY from database?',
        default: false
      })

      if (!shouldDeleteOnlyFromDatabase) {
        const shouldReturnToMenu = await this.cliService.confirm({
          message: 'Return to menu?',
          default: true
        })

        return shouldReturnToMenu ? 'MENU' : 'OK'
      }
    }

    if (args.dryRun) {
      this.printDryRunMessage()
      return 'OK'
    }

    const deleteLoading = this.cliService.loading({
      loadingMessage: 'Deleting video',
      doneMessage: 'Successfully deleted!'
    })

    deleteLoading.start()

    if (!isUploadOlderThanTwoDays) {
      await this.telegramService.deleteMessages({
        channelId: this.preset.telegram.channelId,
        messagesIds: videoUploads.map(videoUpload => videoUpload.telegramPostId)
      })
    }

    await this.videosRepository.deleteFromId(selectedVideo.id)

    deleteLoading.stop(
      isUploadOlderThanTwoDays ? 'Successfully deleted ONLY FROM DATABASE.' : undefined
    )

    if (isUploadOlderThanTwoDays) {
      const oldMessageInfo = [
        'Keep in mind that the desynchronized messages in Telegram are still there.',
        'If you still want to remove them, you should do that manually.'
      ].join('\n')

      this.cliService.printInfo(oldMessageInfo)
    }

    const shouldReturnToMenu = await this.cliService.confirm({
      message: 'Return to menu?',
      default: true
    })

    return shouldReturnToMenu ? 'MENU' : 'OK'
  }
}
