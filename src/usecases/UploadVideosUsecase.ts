import path from 'node:path'

import { args, logger, stepsLogger } from '@/config'
import type { Video } from '@/db'
import { type Preset, Usecase, VideoMetadata } from '@/domain'
import { ImplementationError, UsageError } from '@/errors'
import { VideosRepository, VideoUploadsRepository } from '@/repositories'
import {
  type CLIConfirmContract,
  InquirerCLIService,
  TelegramService,
  VideosService
} from '@/services'
import { getMarkdownEscapedText, getSeparator } from '@/utils'

export class UploadVideosUsecase extends Usecase {
  public readonly actionTitle = 'Upload videos'

  public readonly telegramService: TelegramService
  public readonly videosService: VideosService
  public readonly cliService: CLIConfirmContract

  public readonly videosRepository: VideosRepository
  public readonly videoUploadsRepository: VideoUploadsRepository

  constructor(public readonly preset: Preset) {
    super()

    this.telegramService = new TelegramService({
      apiBaseUrl: preset.telegram.apiBaseUrl,
      botToken: preset.telegram.botToken
    })

    this.videosService = new VideosService()
    this.cliService = new InquirerCLIService()

    this.videosRepository = new VideosRepository()
    this.videoUploadsRepository = new VideoUploadsRepository()
  }

  async execute(): Promise<Usecase.ExecuteReturn> {
    const { videosDirectory } = this.preset

    const isApiAvailable = await this.telegramService.runHealthCheck()
    if (!isApiAvailable) {
      throw new UsageError(`Could not connect to API at "${this.preset.telegram.apiBaseUrl}"`)
    }

    const videosMetadata = await this.videosService.loadVideosMetadata(videosDirectory)

    const listVideosFileNamesResponse =
      await this.videosService.listVideosFileNames(videosDirectory)

    const { videosFileNamesForConversion, videosFileNames } = listVideosFileNamesResponse
    if (videosFileNames.length <= 0 && videosFileNamesForConversion.length <= 0) {
      logger.warn(`No files found at directory "${videosDirectory}"`)
      return 'OK'
    }

    if (videosFileNamesForConversion.length > 0) {
      const shouldConvert = await this.cliService.confirm({
        message: `Found ${videosFileNamesForConversion.length} files that could be uploaded if converted first. Convert them?`,
        default: true
      })

      if (shouldConvert) {
        const convertedVideosFileNames: Array<string> = []

        for (const videoFileName of videosFileNamesForConversion) {
          stepsLogger.info(`Converting file "${videoFileName}"...`)

          const videoPath = path.join(videosDirectory, videoFileName)

          if (args.dryRun) {
            this.printDryRunMessage()
            continue
          }

          await this.videosService.convertVideoToMp4(videoPath)
          convertedVideosFileNames.push(videoFileName)
        }

        videosFileNames.push(...convertedVideosFileNames)
      }
    }

    const shouldAskProceed =
      videosMetadata.length <= 0 || videosFileNames.length !== videosMetadata.length

    if (videosMetadata.length <= 0) {
      logger.warn('File "videos.json" is empty')
    }

    if (videosFileNames.length !== videosMetadata.length) {
      logger.warn(
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

      stepsLogger.info(`\n${getSeparator(logStepIndicator, 5, 'EACH SIDE')}`)
      stepsLogger.info(`Looking for saved video with filename "${videoFileName}"...`)

      let video = await this.videosRepository.getByFilename(videoFileName)
      if (video) {
        stepsLogger.info('Found!\n')

        if (args.dryRun) {
          this.printDryRunMessage()
          continue
        }
      } else {
        stepsLogger.info('Not found.\n')

        if (args.dryRun) {
          this.printDryRunMessage()
          continue
        }

        stepsLogger.info('Saving into database...')

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

        stepsLogger.info('Saved!\n')
      }

      if (video.status === 'UPLOADED') {
        stepsLogger.info('Video already uploaded! Skipping...\n')
        continue
      }

      const videoFileMetadata = await this.videosService.getVideoFileMetadata(videoFilePath)

      stepsLogger.info('Searching for cover image...')

      let videoThumbnailPath: string | undefined
      let videoCoverPath = await this.videosService.getVideoCoverPath(videoFilePath)

      const needsToExtractCover = !videoCoverPath
      if (needsToExtractCover) {
        stepsLogger.info(
          'Cover image not found. It will be extracted from the video file itself.\n'
        )
      } else {
        if (!videoCoverPath) {
          throw new ImplementationError('Unexpected undefined videoCoverPath')
        }

        stepsLogger.info('Cover image found!\n')
        stepsLogger.info('Generating thumbnail...')

        videoThumbnailPath = await this.videosService.convertVideoCoverToThumbnail(videoCoverPath)

        stepsLogger.info('Thumbnail generated!\n')
      }

      const videoSegmentsDirectory = this.videosService.getVideoSegmentsDirectory({
        videosDirectory,
        videoFileNameWithoutExtension
      })

      await this.videosService.deleteVideoSegments(videoSegmentsDirectory)

      stepsLogger.info('Segmenting...')

      await this.videosService.generateVideoSegments({
        videoFilePath,
        videoSegmentsDirectory,
        ...videoFileMetadata
      })

      const videoSegmentsFileNames =
        await this.videosService.listVideoSegmentsFileNames(videoSegmentsDirectory)

      stepsLogger.info('Segmentation done!\n')

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
          stepsLogger.info(
            `Extracting cover image for video segment ${partCurrentString} of ${partTotalString}...`
          )

          videoCoverPath = await this.telegramService.extractVideoCover({
            videoSegmentPath,
            durationInSeconds: videoSegmentFileMetadata.durationInSeconds
          })

          stepsLogger.info(`Extracted!\n`)
          stepsLogger.info(`Generating thumbnail...`)

          videoThumbnailPath = await this.telegramService.convertVideoCoverToThumbnail({
            videoCoverPath
          })

          stepsLogger.info('Thumbnail generated!\n')
        }

        stepsLogger.info(`Uploading video segment ${partCurrentString} of ${partTotalString}...`)

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

        stepsLogger.info(`Video segment uploaded!\n`)
      }

      await this.videosRepository.setUploadedStatusById(video.id)

      stepsLogger.info('All video segments successfully uploaded!')

      await this.videosService.deleteVideoSegments(videoSegmentsDirectory)
    }

    stepsLogger.info('All videos successfully uploaded!')

    return 'OK'
  }
}
