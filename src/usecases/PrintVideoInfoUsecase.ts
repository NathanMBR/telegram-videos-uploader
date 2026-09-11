import { type Preset, Usecase } from '@/domain'
import { VideosRepository, VideoUploadsRepository } from '@/repositories'
import { TelegramService, type CLIService } from '@/services'
import { getSeparator } from '@/utils'

export class PrintVideoInfoUsecase extends Usecase {
  public readonly actionTitle = 'Check video data'

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
    const selectedVideo = await this.cliService.autocomplete({
      message: 'Select the video to show data:',
      getOptions: async input => {
        const videos = await this.videosRepository.getAll(input || '', this.preset.origin)

        const options = videos.map(video => ({
          label: video.title,
          value: video
        }))

        return options
      }
    })

    const selectedVideoUploads = await this.videoUploadsRepository.getAll(selectedVideo.id)

    const statusMapper: Record<typeof selectedVideo.status, string> = {
      STORED_LOCALLY: 'Stored locally',
      UPLOADED: 'Uploaded'
    }

    // Video info
    const publishedAtString = selectedVideo.publishedAt
      ? this.telegramService.transformDbPublishedAt({
          publishedAt: selectedVideo.publishedAt,
          presetAvailabilities: this.preset.postDescription.availability,
          presetDateFormat: this.preset.postDescription.dateFormat
        })
      : '(empty)'

    const createdAtString = this.telegramService.transformDbPublishedAt({
      publishedAt: selectedVideo.createdAt,
      presetAvailabilities: this.preset.postDescription.availability,
      presetDateFormat: this.preset.postDescription.dateFormat
    })

    const updatedAtString = selectedVideo.updatedAt
      ? this.telegramService.transformDbPublishedAt({
          publishedAt: selectedVideo.updatedAt,
          presetAvailabilities: this.preset.postDescription.availability,
          presetDateFormat: this.preset.postDescription.dateFormat
        })
      : '(empty)'

    const videoInfo = [
      getSeparator('VIDEO'),
      `Database ID: ${selectedVideo.id}`,
      `Title: ${selectedVideo.title}`,
      `Description: ${selectedVideo.description || '(empty)'}`,
      `Availability: ${this.telegramService.transformDbAvailability({ availability: selectedVideo.availability, presetAvailabilities: this.preset.postDescription.availability })}`,
      `Status: ${statusMapper[selectedVideo.status]}`,
      `File name: ${selectedVideo.filename}`,
      `Original video URL: ${selectedVideo.url || '(empty)'}`,
      `Published at: ${publishedAtString}`,
      `Created at: ${createdAtString}`,
      `Last updated at: ${updatedAtString}`
    ].join('\n')

    this.cliService.printStep(videoInfo)

    const partTotalString = String(selectedVideoUploads.length).padStart(2, '0')

    for (const [videoUploadIndex, videoUpload] of selectedVideoUploads.entries()) {
      const partCurrentString = String(videoUploadIndex + 1).padStart(2, '0')

      videoUpload.uploadedAt

      const videoUploadInfo = [
        getSeparator(`VIDEO UPLOAD [${partCurrentString}/${partTotalString}]`),
        `Telegram Message ID: ${videoUpload.telegramPostId}`,
        ''
      ].join('\n')

      this.cliService.printStep(videoUploadInfo)
    }

    const shouldReturnToMenu = await this.cliService.confirm({
      message: 'Return to menu?',
      default: true
    })

    return shouldReturnToMenu ? 'MENU' : 'OK'
  }
}
