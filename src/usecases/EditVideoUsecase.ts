import { args } from '@/config'
import { type Preset, Usecase, VideoMetadata, videoAvailabilities } from '@/domain'
import { VideosRepository, VideoUploadsRepository } from '@/repositories'
import {
  type CLIAutocompleteContract,
  type CLIInputContract,
  type CLIPrintContract,
  type CLISelectContract,
  TelegramService
} from '@/services'
import { getMarkdownEscapedText } from '@/utils'

export class EditVideoUsecase extends Usecase {
  public readonly actionTitle = 'Edit video info'

  private readonly videosRepository: VideosRepository
  private readonly videoUploadsRepository: VideoUploadsRepository

  private readonly telegramService: TelegramService

  constructor(
    public readonly preset: Preset,
    private readonly cliService: CLIAutocompleteContract &
      CLISelectContract &
      CLIInputContract &
      CLIPrintContract
  ) {
    super()

    this.videosRepository = new VideosRepository()
    this.videoUploadsRepository = new VideoUploadsRepository()

    this.cliService = cliService

    this.telegramService = new TelegramService({
      apiBaseUrl: preset.telegram.apiBaseUrl,
      botToken: preset.telegram.botToken
    })
  }

  async execute(): Promise<Usecase.ExecuteReturn> {
    const selectedVideo = await this.cliService.autocomplete({
      message: 'Select the video to edit:',
      getOptions: async input => {
        const videos = await this.videosRepository.getAll(input || '', this.preset.origin)

        const options = videos.map(video => ({
          label: video.title,
          value: video
        }))

        return options
      }
    })

    const getEditedVideo = await this.cliService.select({
      message: 'Select the property to edit:',
      options: [
        {
          label: 'Title',
          value: async () => {
            const title = await this.cliService.input({
              message: 'Edit the title:',
              default: selectedVideo.title
            })

            const editedVideo = await this.videosRepository.update(selectedVideo.id, {
              ...selectedVideo,
              title
            })

            return editedVideo
          }
        },
        {
          label: 'Description',
          value: async () => {
            const description = await this.cliService.input({
              message: 'Edit the description:',
              default: selectedVideo.description || ''
            })

            const editedVideo = await this.videosRepository.update(selectedVideo.id, {
              ...selectedVideo,
              description: description || null
            })

            return editedVideo
          }
        },
        {
          label: 'Availability',
          value: async () => {
            const availability = await this.cliService.select({
              message: 'Edit the availability:',
              options: videoAvailabilities.map(availability => ({
                label: this.telegramService.transformDbAvailability({
                  presetAvailabilities: this.preset.postDescription.availability,
                  availability: availability
                }),
                value: availability
              }))
            })

            const editedVideo = await this.videosRepository.update(selectedVideo.id, {
              ...selectedVideo,
              availability
            })

            return editedVideo
          }
        },
        {
          label: 'Publication date',
          value: async () => {
            const publishedAtString = await this.cliService.input({
              message: 'Edit the publication date (optional):',
              isOptional: true,
              validator: input => {
                const invalidDateErrorMessage = 'Invalid date (must be in the YYYY-MM-DD format)'

                if (!input) {
                  return true
                }

                const date = VideoMetadata.transformMetadataUploadDate(input)
                if (!date) {
                  return invalidDateErrorMessage
                }

                return true
              }
            })

            const publishedAt = VideoMetadata.transformMetadataUploadDate(publishedAtString)

            const editedVideo = await this.videosRepository.update(selectedVideo.id, {
              ...selectedVideo,
              publishedAt
            })

            return editedVideo
          }
        },
        {
          label: 'Cancel edit',
          value: null
        }
      ]
    })

    if (!getEditedVideo) {
      return 'MENU'
    }

    if (args.dryRun) {
      this.printDryRunMessage()
      return 'OK'
    }

    const editedVideo = await getEditedVideo()

    const messages = await this.videoUploadsRepository.getAll(selectedVideo.id)

    for (const message of messages) {
      const partCurrentString = String(message.part).padStart(2, '0')
      const partTotalString = String(messages.length).padStart(2, '0')

      const postDescription = this.telegramService.getPostDescription({
        baseText: this.preset.postDescription.baseText,
        videoTitle: getMarkdownEscapedText(editedVideo.title),
        videoUrl: getMarkdownEscapedText(editedVideo.url || ''),
        videoDescription: getMarkdownEscapedText(editedVideo.description || ''),
        channelTitle: getMarkdownEscapedText(this.preset.postDescription.channel.name),
        channelUrl: getMarkdownEscapedText(this.preset.postDescription.channel.url),
        availability: getMarkdownEscapedText(
          this.telegramService.transformDbAvailability({
            presetAvailabilities: this.preset.postDescription.availability,
            availability: editedVideo.availability
          })
        ),
        date: getMarkdownEscapedText(
          this.telegramService.transformDbPublishedAt({
            presetAvailabilities: this.preset.postDescription.availability,
            presetDateFormat: this.preset.postDescription.dateFormat,
            publishedAt: editedVideo.publishedAt
          })
        ),
        partCurrent: partCurrentString,
        partTotal: partTotalString
      })

      await this.telegramService.updateMessage({
        chatId: this.preset.telegram.channelId,
        messageId: message.telegramPostId,
        message: postDescription
      })
    }

    this.cliService.print('Successfully updated!')

    return 'OK'
  }
}
