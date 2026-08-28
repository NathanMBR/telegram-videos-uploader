import { args } from '@/config'
import { type Preset, Usecase } from '@/domain'
import { VideosRepository, VideoUploadsRepository } from '@/repositories'
import {
  type CLIAutocompleteContract,
  type CLIConfirmContract,
  type CLIPrintContract,
  InquirerCLIService,
  TelegramService
} from '@/services'

export class DeleteVideoUsecase extends Usecase {
  public readonly actionTitle = 'Delete video'

  private readonly videosRepository: VideosRepository
  private readonly videoUploadsRepository: VideoUploadsRepository

  private readonly cliService: CLIAutocompleteContract & CLIConfirmContract & CLIPrintContract
  private readonly telegramService: TelegramService

  constructor(public readonly preset: Preset) {
    super()

    this.videosRepository = new VideosRepository()
    this.videoUploadsRepository = new VideoUploadsRepository()

    this.cliService = new InquirerCLIService()
    this.telegramService = new TelegramService({
      apiBaseUrl: preset.telegram.apiBaseUrl,
      botToken: preset.telegram.botToken
    })
  }

  public async execute(): Promise<Usecase.ExecuteReturn> {
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
      this.cliService.print('Deletion cancelled.')
      return 'MENU'
    }

    if (args.dryRun) {
      this.printDryRunMessage()
      return 'OK'
    }

    const videoUploads = await this.videoUploadsRepository.getAll(selectedVideo.id)

    await this.telegramService.deleteMessages({
      channelId: this.preset.telegram.channelId,
      messagesIds: videoUploads.map(videoUpload => videoUpload.telegramPostId)
    })

    await this.videosRepository.deleteFromId(selectedVideo.id)

    this.cliService.print('Successfully deleted!')

    return 'OK'
  }
}
