import path from 'node:path'

import { args } from '@/config'
import type { Video } from '@/db'
import { type Preset, Usecase, VideoMetadata } from '@/domain'
import { ImplementationError } from '@/errors'
import { VideosRepository, VideoUploadsRepository } from '@/repositories'
import { type CLIService, TelegramService, VideosService } from '@/services'
import { getMarkdownEscapedText, getSeparator } from '@/utils'

export class UploadVideosUsecase extends Usecase {
  public readonly actionTitle = 'Upload videos'

  private readonly telegramService: TelegramService
  private readonly videosService: VideosService

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

    this.videosService = new VideosService()

    this.videosRepository = new VideosRepository()
    this.videoUploadsRepository = new VideoUploadsRepository()
  }

  async execute(): Promise<Usecase.ExecuteReturn> {
    const { videosDirectory } = this.preset

    const healthCheckError = await this.telegramService.runHealthCheck()
    if (healthCheckError) {
      throw healthCheckError
    }

    const videosMetadata = await this.videosService.loadVideosMetadata(videosDirectory)

    const listVideosFileNamesResponse =
      await this.videosService.listVideosFileNames(videosDirectory)

    const { videosFileNamesForConversion, videosFileNames } = listVideosFileNamesResponse
    if (videosFileNamesForConversion.length > 0) {
      const shouldConvert = await this.cliService.confirm({
        message: `Found ${videosFileNamesForConversion.length} files that could be uploaded if converted first. Convert them?`,
        default: true
      })

      if (shouldConvert) {
        const convertedVideosFileNames: Array<string> = []

        for (const videoFileName of videosFileNamesForConversion) {
          const conversionLoader = this.cliService.loading({
            loadingMessage: `Converting file "${videoFileName}"...`,
            doneMessage: `Conversion of file "${videoFileName}" done!`
          })

          conversionLoader.start()

          const videoPath = path.join(videosDirectory, videoFileName)

          if (args.dryRun) {
            this.printDryRunMessage()
            continue
          }

          await this.videosService.convertVideoToMp4(videoPath)
          convertedVideosFileNames.push(videoFileName)

          conversionLoader.stop()
        }

        videosFileNames.push(...convertedVideosFileNames)
      }
    }

    if (videosFileNames.length <= 0) {
      this.cliService.printWarn(`No files found at directory "${videosDirectory}"`)

      const shouldReturnToMenu = await this.cliService.confirm({
        message: 'Return to menu?',
        default: true
      })

      return shouldReturnToMenu ? 'MENU' : 'OK'
    }

    const shouldAskProceed =
      videosMetadata.length <= 0 || videosFileNames.length !== videosMetadata.length

    if (videosMetadata.length <= 0) {
      this.cliService.printWarn('File "videos.json" is empty')
    } else if (videosFileNames.length !== videosMetadata.length) {
      this.cliService.printWarn(
        `Amount of files in provided directory (${videosFileNames.length}) doesn't match the amount of entries in "videos.json" (${videosMetadata.length})`
      )
    }

    if (shouldAskProceed) {
      const shouldContinue = await this.cliService.confirm({
        message: 'Proceed?',
        default: false
      })

      if (!shouldContinue) {
        return 'MENU'
      }
    }

    const sortedVideosFileNames = this.videosService.sortVideosFileNamesByVideosMetadataUploadDate({
      videosFileNames,
      videosMetadata
    })

    for (const [videoFileNameIndex, videoFileName] of sortedVideosFileNames.entries()) {
      const videoFilePath = path.resolve(videosDirectory, videoFileName)
      const videoFileNameWithoutExtension = path.parse(videoFileName).name

      const logPadLength = String(videosFileNames.length).length
      const logCurrentStep = String(videoFileNameIndex + 1).padStart(logPadLength, '0')
      const logFinalStep = String(videosFileNames.length).padStart(logPadLength, '0')
      const logStepIndicator = `[${logCurrentStep}/${logFinalStep}]`

      this.cliService.printInfo(`${getSeparator(logStepIndicator, 5, 'EACH SIDE')}`)

      const savedVideoLoader = this.cliService.loading({
        loadingMessage: `Looking for saved video with file name "${videoFileName}"`,
        doneMessage: `Found saved video with file name "${videoFileName}"!`,
        cancelMessage: `Couldn't find saved video with file name "${videoFileName}".`
      })

      savedVideoLoader.start()

      let video = await this.videosRepository.getByFilename(videoFileName)
      if (video) {
        savedVideoLoader.stop()

        if (args.dryRun) {
          this.printDryRunMessage()
          continue
        }
      } else {
        savedVideoLoader.cancel()

        if (args.dryRun) {
          this.printDryRunMessage()
          continue
        }

        const savingVideoLoader = this.cliService.loading({
          loadingMessage: `Saving video with file name ${videoFileName}`,
          doneMessage: `Video with file name ${videoFileName} saved!`
        })

        savingVideoLoader.start()

        const videoMetadata = videosMetadata?.find(
          metadata => path.parse(metadata.filename).name === videoFileNameWithoutExtension
        )

        const videoData: Video.New = videoMetadata
          ? {
              title: videoMetadata.title,
              filename: videoFileName,
              origin: this.preset.origin,
              description: videoMetadata.description,
              url: videoMetadata.webpage_url,
              availability: VideoMetadata.transformMetadataAvailability(videoMetadata.availability),
              publishedAt: VideoMetadata.transformMetadataUploadDate(videoMetadata.upload_date)
            }
          : {
              title: this.videosService.removeYtDlpIdFromFileName(videoFileNameWithoutExtension),
              filename: videoFileName,
              origin: this.preset.origin
            }

        video = await this.videosRepository.save(videoData)

        savingVideoLoader.stop()
      }

      if (video.status === 'UPLOADED') {
        this.cliService.printSuccess('Video already uploaded! Skipping...')
        continue
      }

      const videoFileMetadata = await this.videosService.getVideoFileMetadata(videoFilePath)

      let videoThumbnailPath: string | undefined
      let videoCoverPath = await this.videosService.getVideoCoverPath(videoFilePath)

      const needsToExtractCover = !videoCoverPath
      if (needsToExtractCover) {
        this.cliService.printWarn(
          'Cover image not found. It will be extracted from the video file itself.'
        )
      } else {
        if (!videoCoverPath) {
          throw new ImplementationError('Unexpected undefined videoCoverPath')
        }

        this.cliService.printStep('Cover image found!')

        videoThumbnailPath = await this.videosService.convertVideoCoverToThumbnail(videoCoverPath)

        this.cliService.printStep('Thumbnail generated!')
      }

      const videoSegmentsDirectory = this.videosService.getVideoSegmentsDirectory({
        videosDirectory,
        videoFileNameWithoutExtension
      })

      await this.videosService.deleteVideoSegments(videoSegmentsDirectory)

      const baseSegmentingMessage = 'Segmenting video'

      const segmentingProgress = this.cliService.progress({
        initialMessage: `${baseSegmentingMessage} (0%)`,
        progressMax: 100
      })

      let segmentingPercentage = 0

      await this.videosService.generateVideoSegments({
        videoFilePath,
        videoSegmentsDirectory,
        ...videoFileMetadata,
        percentageDeltaReporter: percentageDelta => {
          segmentingPercentage += percentageDelta

          segmentingProgress.addToProgress(percentageDelta)
          segmentingProgress.changeMessage(
            `${baseSegmentingMessage} (${Math.round(segmentingPercentage)}%)`
          )
        }
      })

      segmentingProgress.finish('Segmentation done!')

      const videoSegmentsFileNames =
        await this.videosService.listVideoSegmentsFileNames(videoSegmentsDirectory)

      for (const [videoSegmentIndex, videoSegmentFileName] of videoSegmentsFileNames.entries()) {
        const partCurrent = videoSegmentIndex + 1

        const partCurrentString = String(partCurrent).padStart(2, '0')
        const partTotalString = String(videoSegmentsFileNames.length).padStart(2, '0')
        const videoSegmentPath = path.join(videoSegmentsDirectory, videoSegmentFileName)

        const postDescription = this.telegramService.getPostDescription({
          baseText: this.preset.postDescription.baseText,
          videoTitle: getMarkdownEscapedText(video.title),
          videoUrl: getMarkdownEscapedText(video.url || ''),
          videoDescription: getMarkdownEscapedText(video.description || ''),
          channelTitle: getMarkdownEscapedText(this.preset.postDescription.channel.name),
          channelUrl: getMarkdownEscapedText(this.preset.postDescription.channel.url),
          availability: getMarkdownEscapedText(
            this.telegramService.transformDbAvailability({
              presetAvailabilities: this.preset.postDescription.availability,
              availability: video.availability
            })
          ),
          date: getMarkdownEscapedText(
            this.telegramService.transformDbPublishedAt({
              presetAvailabilities: this.preset.postDescription.availability,
              presetDateFormat: this.preset.postDescription.dateFormat,
              publishedAt: video.publishedAt
            })
          ),
          partCurrent: partCurrentString,
          partTotal: partTotalString
        })

        const videoSegmentFileMetadata =
          await this.videosService.getVideoFileMetadata(videoSegmentPath)

        if (needsToExtractCover) {
          videoCoverPath = await this.telegramService.extractVideoCover({
            videoSegmentPath,
            durationInSeconds: videoSegmentFileMetadata.durationInSeconds
          })

          this.cliService.printStep(
            `Cover image for video segment ${partCurrentString} of ${partTotalString} extracted!`
          )

          videoThumbnailPath = await this.telegramService.convertVideoCoverToThumbnail({
            videoCoverPath
          })

          this.cliService.printStep(
            `Thumbnail for video segment ${partCurrentString} of ${partTotalString} generated!`
          )
        }

        const uploadLoader = this.cliService.loading({
          loadingMessage: `Uploading video segment ${partCurrentString} of ${partTotalString}`,
          doneMessage: `Video segment ${partCurrentString} of ${partTotalString} uploaded!`
        })

        uploadLoader.start()

        const telegramPost = await this.telegramService.uploadVideoToChannel({
          channelId: this.preset.telegram.channelId,
          videoPath: videoSegmentPath,
          width: videoSegmentFileMetadata.width,
          height: videoSegmentFileMetadata.height,
          durationInSeconds: videoSegmentFileMetadata.durationInSeconds,
          postDescription,
          videoCoverPath,
          videoThumbnailPath
        })

        await this.videoUploadsRepository.save({
          telegramPostId: telegramPost.messageId,
          uploadedAt: telegramPost.uploadedAt,
          videoId: video.id,
          part: partCurrent
        })

        uploadLoader.stop()
      }

      await this.videosRepository.setUploadedStatusById(video.id)

      await this.videosService.deleteVideoSegments(videoSegmentsDirectory)
    }

    this.cliService.printSuccess('All videos successfully uploaded!')

    const shouldReturnToMenu = await this.cliService.confirm({
      message: 'Return to menu?',
      default: true
    })

    return shouldReturnToMenu ? 'MENU' : 'OK'
  }
}
