import path from 'node:path'

import * as cli from '@inquirer/prompts'

import { args, logger, stepsLogger } from '@/config'
import type { NewVideo } from '@/db'
import { type Preset, Usecase } from '@/domain'
import { VideosRepository } from '@/repositories'
import { TelegramService, VideosService } from '@/services'
import { getMarkdownEscapedText, getSeparator } from '@/utils'

export class UploadVideos extends Usecase {
  public readonly telegramService: TelegramService
  public readonly videosService: VideosService
  public readonly videosRepository: VideosRepository

  constructor(public readonly preset: Preset) {
    super()

    this.telegramService = new TelegramService({
      apiBaseUrl: preset.telegram.apiBaseUrl,
      botToken: preset.telegram.botToken
    })

    this.videosService = new VideosService()
    this.videosRepository = new VideosRepository()
  }

  async execute() {
    const { videosDirectory } = this.preset

    const isApiAvailable = await this.telegramService.runHealthCheck()
    if (!isApiAvailable) {
      throw new Error(`Could not connect to API at "${this.preset.telegram.apiBaseUrl}"`)
    }

    const videosFileNames = await this.videosService.listVideosFileNames(videosDirectory)
    const [videosMetadata, videosMetadataError] =
      await this.videosService.loadVideosMetadata(videosDirectory)

    if (videosFileNames.length <= 0) {
      logger.warn(`No .mp4 files found at directory "${videosDirectory}"`)
      return
    }

    let shouldAskProceed = false

    if (videosMetadataError) {
      logger.warn(
        `Could not load the content of the "videos.json" file. Reason: ${videosMetadataError.message}`
      )

      shouldAskProceed = true
    } else if (videosMetadata.length <= 0) {
      logger.warn('File "videos.json" not found, inaccessible or empty')

      shouldAskProceed = true
    } else if (videosFileNames.length !== videosMetadata.length) {
      logger.warn(
        `Amount of files in provided directory (${videosFileNames.length}) doesn't match the amount of entries in "videos.json" (${videosMetadata.length})`
      )

      shouldAskProceed = true
    }

    if (shouldAskProceed) {
      const shouldContinue = await cli.confirm({
        message: 'Proceed?',
        default: false
      })

      if (!shouldContinue) {
        return
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

        const videoData: NewVideo = videoMetadata
          ? {
              title: videoMetadata.title,
              filename: videoFileName,
              origin: this.preset.origin,
              description: videoMetadata.description,
              url: videoMetadata.webpage_url,
              availability: this.videosService.transformMetadataAvailability(
                videoMetadata.availability
              ),
              publishedAt: this.videosService.transformMetadataUploadDate(videoMetadata.upload_date)
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
          throw new Error('Unexpected undefined videoCoverPath')
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
        const partCurrent = String(videoSegmentIndex + 1).padStart(2, '0')
        const partTotal = String(videoSegmentsFileNames.length).padStart(2, '0')
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
          partCurrent,
          partTotal
        })

        const videoSegmentFileMetadata =
          await this.videosService.getVideoFileMetadata(videoSegmentPath)

        if (needsToExtractCover) {
          stepsLogger.info(
            `Extracting cover image for video segment ${partCurrent} of ${partTotal}...`
          )

          videoCoverPath = await this.telegramService.extractVideoCover({
            videoSegmentPath,
            durationInSeconds: videoSegmentFileMetadata.durationInSeconds
          })

          stepsLogger.info(`Extracted!\n`)
          stepsLogger.info(`Generating thumbnail...`)

          videoThumbnailPath =
            await this.telegramService.convertVideoCoverToThumbnail(videoCoverPath)

          stepsLogger.info('Thumbnail generated!\n')
        }

        stepsLogger.info(`Uploading video segment ${partCurrent} of ${partTotal}...`)

        await this.telegramService.uploadVideoToChannel({
          channelId: this.preset.telegram.channelId,
          videoPath: videoSegmentPath,
          width: videoSegmentFileMetadata.width,
          height: videoSegmentFileMetadata.height,
          durationInSeconds: videoSegmentFileMetadata.durationInSeconds,
          postDescription,
          videoCoverPath,
          videoThumbnailPath
        })

        stepsLogger.info(`Video segment uploaded!\n`)
      }

      await this.videosRepository.setUploadedStatusById(video.id)

      stepsLogger.info('All video segments successfully uploaded!')

      await this.videosService.deleteVideoSegments(videoSegmentsDirectory)
    }

    stepsLogger.info('All videos successfully uploaded!')
  }
}
