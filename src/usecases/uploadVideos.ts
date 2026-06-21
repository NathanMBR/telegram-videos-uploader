import path from 'node:path'

import * as cli from '@inquirer/prompts'

import { logger, stepsLogger } from '@/config'
import type { NewVideo } from '@/db'
import type { Preset } from '@/domain'
import { VideosRepository } from '@/repositories'
import { TelegramService, VideosService } from '@/services'
import { getMarkdownEscapedText } from '@/utils'

const telegramService = new TelegramService()
const videosService = new VideosService()
const videosRepository = new VideosRepository()

export const uploadVideos = async (preset: Preset) => {
  const { videosDirectory } = preset

  const videosFileNames = await videosService.listVideosFileNames(videosDirectory)
  const [videosMetadata, videosMetadataError] =
    await videosService.loadVideosMetadata(videosDirectory)

  if (videosMetadataError) {
    logger.warn(
      `Could not load the content of the "videos.json" file. Reason: ${videosMetadataError.message}`
    )

    const shouldContinue = await cli.confirm({
      message: 'Proceed?',
      default: false
    })

    if (!shouldContinue) {
      return
    }
  } else if (videosMetadata.length <= 0) {
    logger.warn('File "videos.json" not found, inaccessible or empty')
  } else if (videosFileNames.length !== videosMetadata.length) {
    logger.warn(
      `Amount of files in provided directory (${videosFileNames.length}) doesn't match the amount of entries in "videos.json" (${videosMetadata.length})`
    )
  }

  if (videosFileNames.length <= 0) {
    logger.warn(`No .mp4 files found at directory "${videosDirectory}"`)
    return
  }

  for (const [videoFileNameIndex, videoFileName] of videosFileNames.entries()) {
    const videoFilePath = path.resolve(videosDirectory, videoFileName)
    const videoFileNameWithoutExtension = path.parse(videoFileName).name

    const logPadLength = String(videosFileNames.length).length
    const logCurrentStep = String(videoFileNameIndex + 1).padStart(logPadLength, '0')
    const logFinalStep = String(videosFileNames.length).padStart(logPadLength, '0')

    stepsLogger.info(`\n-----[${logCurrentStep}/${logFinalStep}]-----`)
    stepsLogger.info(`Looking for saved video with filename "${videoFileName}"...`)

    let video = await videosRepository.getByFilename(videoFileName)
    if (video) {
      stepsLogger.info('Found!\n')
    } else {
      stepsLogger.info('Not found.\n')
      stepsLogger.info('Saving into database...')

      const videoMetadata = videosMetadata?.find(
        metadata => path.parse(metadata.filename).name === videoFileNameWithoutExtension
      )

      const videoData: NewVideo = videoMetadata
        ? {
            title: videoMetadata.title,
            filename: videoFileName,
            origin: preset.origin,
            description: videoMetadata.description,
            url: videoMetadata.webpage_url,
            availability: videosRepository.transformMetadataAvailability(
              videoMetadata.availability
            ),
            publishedAt: videosRepository.transformMetadataUploadDate(videoMetadata.upload_date)
          }
        : {
            title: videoFileNameWithoutExtension,
            filename: videoFileName,
            origin: preset.origin
          }

      video = await videosRepository.save(videoData)

      stepsLogger.info('Saved!\n')
    }

    if (video.status === 'UPLOADED') {
      stepsLogger.info('Video already uploaded! Skipping...\n')
      continue
    }

    const videoFileMetadata = await videosService.getVideoFileMetadata(videoFilePath)

    stepsLogger.info('Searching for cover image...')

    let videoThumbnailPath: string | undefined
    let videoCoverPath = await videosService.getVideoCoverPath(videoFilePath)

    const needsToExtractCover = !videoCoverPath
    if (needsToExtractCover) {
      stepsLogger.info('Cover image not found. It will be extracted from the video file itself.\n')
    } else {
      if (!videoCoverPath) {
        throw new Error('Unexpected undefined videoCoverPath')
      }

      stepsLogger.info('Cover image found!\n')
      stepsLogger.info('Generating thumbnail...')

      videoThumbnailPath = await videosService.convertVideoCoverToThumbnail(videoCoverPath)

      stepsLogger.info('Thumbnail generated!\n')
    }

    const videoSegmentsDirectory = videosService.getVideoSegmentsDirectory({
      videosDirectory,
      videoFileNameWithoutExtension
    })

    await videosService.deleteVideoSegments(videoSegmentsDirectory)

    stepsLogger.info('Segmenting...')

    await videosService.generateVideoSegments({
      videoFilePath,
      videoSegmentsDirectory,
      ...videoFileMetadata
    })

    const videoSegmentsFileNames =
      await videosService.listVideoSegmentsFileNames(videoSegmentsDirectory)

    stepsLogger.info('Segmentation done!\n')

    for (const [videoSegmentIndex, videoSegmentFileName] of videoSegmentsFileNames.entries()) {
      const partCurrent = String(videoSegmentIndex + 1).padStart(2, '0')
      const partTotal = String(videoSegmentsFileNames.length).padStart(2, '0')
      const videoSegmentPath = path.join(videoSegmentsDirectory, videoSegmentFileName)

      const postDescription = telegramService.getPostDescription({
        baseText: preset.postDescription.baseText,
        videoTitle: getMarkdownEscapedText(video.title),
        videoUrl: getMarkdownEscapedText(video.url || ''),
        videoDescription: getMarkdownEscapedText(video.description || ''),
        channelTitle: getMarkdownEscapedText(preset.postDescription.channel.name),
        channelUrl: getMarkdownEscapedText(preset.postDescription.channel.url),
        availability: getMarkdownEscapedText(
          telegramService.transformDbAvailability({
            presetAvailabilities: preset.postDescription.availability,
            availability: video.availability
          })
        ),
        date: getMarkdownEscapedText(
          telegramService.transformDbPublishedAt({
            presetDateFormat: preset.postDescription.dateFormat,
            publishedAt: video.publishedAt
          })
        ),
        partCurrent,
        partTotal
      })

      const videoSegmentFileMetadata = await videosService.getVideoFileMetadata(videoSegmentPath)

      if (needsToExtractCover) {
        stepsLogger.info(
          `Extracting cover image for video segment ${partCurrent} of ${partTotal}...`
        )

        videoCoverPath = await telegramService.extractVideoCover({
          videoSegmentPath,
          durationInSeconds: videoSegmentFileMetadata.durationInSeconds
        })

        stepsLogger.info(`Extracted!\n`)
        stepsLogger.info(`Generating thumbnail...`)

        videoThumbnailPath = await telegramService.convertVideoCoverToThumbnail(videoCoverPath)

        stepsLogger.info('Thumbnail generated!\n')
      }

      stepsLogger.info(`Uploading video segment ${partCurrent} of ${partTotal}...`)

      await telegramService.uploadVideoToChannel({
        apiBaseUrl: preset.telegram.apiBaseUrl,
        botToken: preset.telegram.botToken,
        channelId: preset.telegram.channelId,
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

    await videosRepository.setUploadedStatusById(video.id)

    stepsLogger.info('All video segments successfully uploaded!')
  }

  stepsLogger.info('All videos successfully uploaded!')
}
