import * as cli from '@inquirer/prompts'

import { args, stepsLogger } from '@/config'
import { type Preset, Usecase } from '@/domain'
import { VideosRepository, VideoUploadsRepository } from '@/repositories'
import { TelegramService } from '@/services'

export class DeleteVideoUsecase extends Usecase {
  private readonly videosRepository: VideosRepository
  private readonly videoUploadsRepository: VideoUploadsRepository
  private readonly telegramService: TelegramService

  constructor(public readonly preset: Preset) {
    super()

    this.videosRepository = new VideosRepository()
    this.videoUploadsRepository = new VideoUploadsRepository()

    this.telegramService = new TelegramService({
      apiBaseUrl: preset.telegram.apiBaseUrl,
      botToken: preset.telegram.botToken
    })
  }

  public async execute() {
    const selectedVideo = await cli.search({
      message: 'Select the video to remove:',
      source: async input => {
        const videos = await this.videosRepository.getAll(input || '', this.preset.origin)

        const options = videos.map(video => ({ name: video.title, value: video }))

        return options
      }
    })

    const deleteConfirmation = await cli.confirm({
      message: 'Are you sure you want to delete?',
      default: false
    })

    if (!deleteConfirmation) {
      stepsLogger.info('Deletion cancelled.')
      return
    }

    if (args.dryRun) {
      this.printDryRunMessage()
      return
    }

    const videoUploads = await this.videoUploadsRepository.getAll(selectedVideo.id)

    await this.telegramService.deleteMessages({
      channelId: this.preset.telegram.channelId,
      messagesIds: videoUploads.map(videoUpload => videoUpload.telegramPostId)
    })

    await this.videosRepository.deleteFromId(selectedVideo.id)

    stepsLogger.info('Successfully deleted!')
  }
}
