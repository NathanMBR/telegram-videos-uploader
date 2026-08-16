import * as cli from '@inquirer/prompts'

import { args, stepsLogger } from '@/config'
import { type Preset, Usecase } from '@/domain'
import { VideosRepository } from '@/repositories'
import { TelegramService } from '@/services'

export class DeleteVideoUsecase extends Usecase {
  public readonly videosRepository: VideosRepository
  public readonly telegramService: TelegramService

  constructor(public readonly preset: Preset) {
    super()

    this.videosRepository = new VideosRepository()
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

    const deleteConfirmation = await cli.confirm({ message: 'Are you sure you want to delete?' })

    if (!deleteConfirmation) {
      stepsLogger.info('Deletion cancelled.')
      return
    }

    if (args.dryRun) {
      this.printDryRunMessage()
      return
    }

    await this.telegramService.deleteMessages({
      channelId: this.preset.telegram.channelId,
      messagesIds: [selectedVideo.id]
    })

    await this.videosRepository.deleteFromId(selectedVideo.id)

    stepsLogger.info('Successfully deleted!')
  }
}
