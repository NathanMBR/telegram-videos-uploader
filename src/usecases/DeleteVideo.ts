import * as cli from '@inquirer/prompts'

import { args, stepsLogger } from '@/config'
import { type Preset, Usecase } from '@/domain'
import { VideosRepository } from '@/repositories'

export class DeleteVideo extends Usecase {
  public readonly videosRepository: VideosRepository

  constructor(public readonly preset: Preset) {
    super()

    this.videosRepository = new VideosRepository()
  }

  public async execute() {
    const selectedVideo = await cli.search({
      message: 'Select the video to remove:',
      source: async input => {
        const videos = await this.videosRepository.getAll(input || '')

        const options = videos.map(video => ({ name: video.title, value: video }))

        return options
      }
    })

    const deleteConfirmation = await cli.confirm({ message: 'Are you sure you want to delete?' })

    if (!deleteConfirmation) {
      stepsLogger.info('Deletion cancelled.')
      return
    }

    if (!args.dryRun) {
      await this.videosRepository.deleteFromId(selectedVideo.id)
    } else {
      this.printDryRunMessage()
    }
    stepsLogger.info('Successfully deleted!')
  }
}
