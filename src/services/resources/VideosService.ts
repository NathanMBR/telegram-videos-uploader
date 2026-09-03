import fs from 'node:fs/promises'
import path from 'node:path'

import {
  type VideoFileMetadata,
  VideoMetadata,
  type VideosMetadata,
  videosMetadataSchema
} from '@/domain'
import { ImplementationError, UsageError } from '@/errors'
import { checkPathAccessibility, execFile, spawn } from '@/utils'

export namespace VideosService {
  export type GenerateVideoSegmentsDTO = {
    videoFilePath: string
    videoSegmentsDirectory: string
    sizeInBytes: number
    durationInSeconds: number
    percentageDeltaReporter?: (percentageDelta: number) => void
  }

  export type GetVideoSegmentsDirectoryDTO = {
    videosDirectory: string
    videoFileNameWithoutExtension: string
  }

  export type ListVideosFileNamesResult = {
    videosFileNames: Array<string>
    videosFileNamesForConversion: Array<string>
  }

  export type SortByVideosMetadataUploadDateDTO = {
    videosFileNames: Array<string>
    videosMetadata: VideosMetadata | null
  }
}

export class VideosService {
  private readonly segmentsDirectory = 'segments'
  private readonly acceptedVideoFormats = ['.mp4']
  private readonly acceptedWithConversionVideoFormats = [
    '.mkv',
    '.avi',
    '.wmv',
    '.webm',
    '.mov',
    '.mpg',
    '.mpeg',
    '.flv',
    '.ogv',
    '.3gp',
    '.vob',
    '.mxf'
  ]

  async convertVideoCoverToThumbnail(videoCoverPath: string): Promise<string> {
    const coverPathParsed = path.parse(videoCoverPath)

    const thumbnailPath = path.join(coverPathParsed.dir, `${coverPathParsed.name}_thumbnail.jpeg`)

    const ffmpegCommandArgs = [
      '-i',
      videoCoverPath,
      '-vf',
      'scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2',
      '-q:v',
      '3',
      '-y',
      thumbnailPath
    ]

    await execFile('ffmpeg', ffmpegCommandArgs)

    return thumbnailPath
  }

  async convertVideoToMp4(videoPath: string): Promise<string> {
    const videoPathParsed = path.parse(videoPath)

    const convertedFileName = `${videoPathParsed.name}.mp4`
    const convertedFilePath = path.join(videoPathParsed.dir, convertedFileName)

    const ffmpegCommandArgs: Array<string> = [
      '-y',
      '-i',
      videoPath,
      '-c:v',
      'libx264',
      '-c:a',
      'aac',
      convertedFilePath
    ]

    await execFile('ffmpeg', ffmpegCommandArgs)

    return convertedFileName
  }

  async deleteVideoSegments(videoSegmentsDirectory: string): Promise<void> {
    const videoSegmentsDirectoryAcessibility = await checkPathAccessibility(videoSegmentsDirectory)
    if (videoSegmentsDirectoryAcessibility === 'UNACCESSIBLE') {
      throw new UsageError(
        `Video segments directory "${videoSegmentsDirectory}" isn't accessible; check its permissions and try again`
      )
    }

    if (videoSegmentsDirectoryAcessibility === 'OK') {
      await fs.rm(videoSegmentsDirectory, { force: true, recursive: true })
    }

    return
  }

  async generateVideoSegments(dto: VideosService.GenerateVideoSegmentsDTO): Promise<void> {
    const {
      videoFilePath,
      videoSegmentsDirectory,
      sizeInBytes,
      durationInSeconds,
      percentageDeltaReporter
    } = dto

    const { name: videoFileNameWithoutExtension, ext: videoFileExtension } =
      path.parse(videoFilePath)

    const maxSizePerFileInBytes = 1792 * 1024 * 1024 // 1.75GB in MB * 1 MB in KB * 1 KB in B

    const numberOfFiles = Math.ceil(sizeInBytes / maxSizePerFileInBytes)

    const durationOfEachFileInSeconds = durationInSeconds / numberOfFiles

    const videoSegmentsDirectoryAccessibility = await checkPathAccessibility(videoSegmentsDirectory)

    if (videoSegmentsDirectoryAccessibility === 'UNACCESSIBLE') {
      throw new UsageError(
        `Video segments directory "${videoSegmentsDirectory}" isn't accessible; check its permissions and try again`
      )
    }

    if (videoSegmentsDirectoryAccessibility === 'INEXISTENT') {
      await fs.mkdir(videoSegmentsDirectory, { recursive: true })
    }

    if (sizeInBytes <= maxSizePerFileInBytes) {
      const symlinkName = [videoFileNameWithoutExtension, '_01-01', videoFileExtension].join('')

      const symlinkPath = path.join(videoSegmentsDirectory, symlinkName)

      await fs.symlink(videoFilePath, symlinkPath, 'file')

      return
    }

    const ffmpegCommandOutputFileName = [
      videoFileNameWithoutExtension,
      '_%02d-',
      numberOfFiles.toString().padStart(2, '0'),
      videoFileExtension
    ].join('')

    const ffmpegCommandOutputFilePath = path.join(
      videoSegmentsDirectory,
      ffmpegCommandOutputFileName
    )

    const ffmpegCommandArgs = [
      `-i`,
      videoFilePath,
      `-c`,
      `copy`,
      `-movflags`,
      `+faststart`,
      `-map`,
      `0`,
      `-f`,
      `segment`,
      `-segment_start_number`,
      `1`,
      `-segment_time`,
      `${durationOfEachFileInSeconds}`,
      `-reset_timestamps`,
      `1`,
      '-progress',
      'pipe:1',
      ffmpegCommandOutputFilePath
    ]

    let currentPercentage = 0
    let ffmpegBufferString = ''

    await spawn({
      command: 'ffmpeg',
      args: ffmpegCommandArgs,
      onData: data => {
        if (!percentageDeltaReporter) {
          return
        }

        ffmpegBufferString += data.toString()

        const lines = ffmpegBufferString.split('\n')

        ffmpegBufferString = lines.pop() || ''

        for (const line of lines) {
          const outTimeKey = 'out_time_ms='

          if (!line.startsWith(outTimeKey)) {
            continue
          }

          const outTimeString = line.split(outTimeKey)[1]?.trim() || ''
          const outTime = Number(outTimeString)
          if (Number.isNaN(outTime) || !Number.isFinite(outTime)) {
            continue
          }

          const outTimeMs = outTime / 1_000

          const durationInMs = durationInSeconds * 1_000

          const reportedPercentage = Math.min((outTimeMs / durationInMs) * 100, 100)

          const percentageDelta = Math.floor(reportedPercentage - currentPercentage)
          if (percentageDelta <= 0) {
            continue
          }

          currentPercentage = Math.max(reportedPercentage, currentPercentage)

          percentageDeltaReporter(percentageDelta)
        }
      }
    })
  }

  async getVideoCoverPath(videoFilePath: string): Promise<string | undefined> {
    const videoFilePathParsed = path.parse(videoFilePath)

    const acceptedFormats = ['.jpg', '.jpeg']

    for (const format of acceptedFormats) {
      const coverPath = path.join(videoFilePathParsed.dir, `${videoFilePathParsed.name}${format}`)

      const coverAccessibility = await checkPathAccessibility(coverPath)
      if (coverAccessibility === 'OK') {
        return coverPath
      }
    }

    return undefined
  }

  async getVideoFileMetadata(videoFilePath: string): Promise<VideoFileMetadata> {
    const ffprobeCommandArgs = [
      `-v`,
      `error`,
      `-select_streams`,
      `v:0`,
      `-show_entries`,
      `stream=width,height:format=duration`,
      `-of`,
      `default=noprint_wrappers=1:nokey=1`,
      videoFilePath
    ]

    const [videoStats, ffprobeOutput] = await Promise.all([
      fs.stat(videoFilePath),
      execFile('ffprobe', ffprobeCommandArgs)
    ])

    const sizeInBytes = videoStats.size

    const [widthString, heightString, durationInSecondsString] = ffprobeOutput.trim().split('\n')

    if (!widthString) {
      throw new ImplementationError(`Unexpected missing width of file "${videoFilePath}"`)
    }

    if (!heightString) {
      throw new ImplementationError(`Unexpected missing height of file "${videoFilePath}"`)
    }

    if (!durationInSecondsString) {
      throw new ImplementationError(`Unexpected missing duration of file "${videoFilePath}"`)
    }

    const width = Number.parseInt(widthString, 10)
    if (!Number.isFinite(width)) {
      throw new ImplementationError(`Unexpected infinite width of file "${videoFilePath}"`)
    }

    const height = Number.parseInt(heightString, 10)
    if (!Number.isFinite(height)) {
      throw new ImplementationError(`Unexpected infinite height of file "${videoFilePath}"`)
    }

    const durationInSeconds = Number.parseFloat(durationInSecondsString)
    if (!Number.isFinite(durationInSeconds)) {
      throw new ImplementationError(`Unexpected infinite duration of file "${videoFilePath}"`)
    }

    return {
      width,
      height,
      durationInSeconds,
      sizeInBytes
    }
  }

  getVideoSegmentsDirectory(dto: VideosService.GetVideoSegmentsDirectoryDTO): string {
    const { videosDirectory, videoFileNameWithoutExtension } = dto

    const videoSegmentsDirectory = path.resolve(
      videosDirectory,
      this.segmentsDirectory,
      videoFileNameWithoutExtension
    )

    return videoSegmentsDirectory
  }

  async listVideosFileNames(
    videosDirectory: string
  ): Promise<VideosService.ListVideosFileNamesResult> {
    const videosDirectoryStatus = await checkPathAccessibility(videosDirectory)
    if (videosDirectoryStatus === 'INEXISTENT') {
      throw new UsageError(`Videos directory "${videosDirectory}" doesn't exist`)
    }

    if (videosDirectoryStatus === 'UNACCESSIBLE') {
      throw new UsageError(
        `Videos directory "${videosDirectory}" isn't accessible; check its permissions and try again`
      )
    }

    const fileNames = await fs.readdir(videosDirectory)

    const videosFileNames = fileNames.filter(fileName =>
      this.acceptedVideoFormats.some(format => fileName.endsWith(format))
    )

    const videosFileNamesForConversion = fileNames.filter(fileName =>
      this.acceptedWithConversionVideoFormats.some(format => fileName.endsWith(format))
    )

    return {
      videosFileNames,
      videosFileNamesForConversion
    }
  }

  async listVideoSegmentsFileNames(videoSegmentsDirectory: string): Promise<Array<string>> {
    const fileNames = await fs.readdir(videoSegmentsDirectory)

    const segmentsFileNames = fileNames.filter(fileName =>
      this.acceptedVideoFormats.some(format => fileName.endsWith(format))
    )

    return segmentsFileNames
  }

  async loadVideosMetadata(videosDirectory: string): Promise<VideosMetadata> {
    // Hard-coded "videos.json" since there is no option to customize that in the present moment
    const metadataPath = path.join(videosDirectory, 'videos.json')

    const metadataAccessibility = await checkPathAccessibility(metadataPath)
    if (metadataAccessibility === 'INEXISTENT') {
      return []
    }

    if (metadataAccessibility === 'UNACCESSIBLE') {
      throw new UsageError(`Videos metadata path "${metadataPath}" isn't accessible`)
    }

    const metadataBuffer = await fs.readFile(metadataPath)
    const metadataObject = JSON.parse(metadataBuffer.toString())

    const metadataValidationResult = videosMetadataSchema.safeParse(metadataObject)
    if (!metadataValidationResult.success) {
      const [issue] = metadataValidationResult.error.issues
      if (!issue) {
        throw new ImplementationError('Unexpected videosMetadataSchema validation error')
      }

      throw new UsageError(issue.message)
    }

    return metadataValidationResult.data
  }

  removeYtDlpIdFromFileName(fileName: string): string {
    const ytDlpIdPattern = /\s*\[[^\]]*\](?=(?:\.[^.]+)?$)/

    if (!ytDlpIdPattern.test(fileName)) {
      return fileName
    }

    return fileName.replace(ytDlpIdPattern, '')
  }

  sortVideosFileNamesByVideosMetadataUploadDate(
    dto: VideosService.SortByVideosMetadataUploadDateDTO
  ): VideosService.SortByVideosMetadataUploadDateDTO['videosFileNames'] {
    const { videosMetadata, videosFileNames } = dto

    const collator = new Intl.Collator()

    if (!videosMetadata) {
      return videosFileNames.toSorted(collator.compare)
    }

    const sortedVideosFileNames = videosFileNames.toSorted(collator.compare).toSorted((a, b) => {
      const videoAFileNameWithoutExtension = path.parse(a).name
      const videoBFileNameWithoutExtension = path.parse(b).name

      const videoAMetadata = videosMetadata.find(
        metadata => path.parse(metadata.filename).name === videoAFileNameWithoutExtension
      )

      const videoBMetadata = videosMetadata.find(
        metadata => path.parse(metadata.filename).name === videoBFileNameWithoutExtension
      )

      const videoAUploadDate = VideoMetadata.transformMetadataUploadDate(
        videoAMetadata?.upload_date || ''
      )

      const videoBUploadDate = VideoMetadata.transformMetadataUploadDate(
        videoBMetadata?.upload_date || ''
      )

      return (videoAUploadDate?.getTime() || 0) - (videoBUploadDate?.getTime() || 0)
    })

    return sortedVideosFileNames
  }
}
