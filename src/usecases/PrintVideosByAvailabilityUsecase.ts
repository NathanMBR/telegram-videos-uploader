import { type Preset, Usecase, videoAvailabilities } from '@/domain'
import { VideosRepository } from '@/repositories'
import { type CLIService, TelegramService } from '@/services'
import { getSeparator } from '@/utils'

export class PrintVideosByAvailabilityUsecase extends Usecase {
  public readonly actionTitle = 'List videos by availability'

  private readonly videosRepository: VideosRepository
  private readonly telegramService: TelegramService

  constructor(
    protected readonly preset: Preset,
    private readonly cliService: CLIService
  ) {
    super()

    this.videosRepository = new VideosRepository(this.preset.origin)
    this.telegramService = new TelegramService({
      apiBaseUrl: preset.telegram.apiBaseUrl,
      botToken: preset.telegram.botToken
    })
  }

  public async execute(): Promise<Usecase.ExecuteReturn> {
    const [selectedAvailability, selectedAvailabilityLabel] = await this.cliService.select({
      message: 'Select the availability:',
      options: videoAvailabilities.map(availability => {
        const label = this.telegramService.transformDbAvailability({
          availability,
          presetAvailabilities: this.preset.postDescription.availability
        })

        return {
          label,
          value: [availability, label]
        }
      })
    })

    const videos = await this.videosRepository.getAllByAvailability(selectedAvailability)

    const videosInfoArray = videos.map(video => `* ${video.title}`)
    videosInfoArray.unshift(
      getSeparator(`VIDEOS WITH AVAILABILITY "${selectedAvailabilityLabel}"`, 10, 'EACH SIDE'),
      ''
    )

    const videosInfo = videosInfoArray.join('\n')
    this.cliService.printInfo(videosInfo)

    const shouldReturnToMenu = await this.cliService.confirm({
      message: 'Return to menu?',
      default: true
    })

    return shouldReturnToMenu ? 'MENU' : 'OK'
  }
}
