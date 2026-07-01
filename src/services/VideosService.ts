import fs from 'node:fs/promises'
import path from 'node:path'
import { stepsLogger } from '@/config'
import { type VideoFileMetadata, type VideosMetadata, videosMetadataSchema } from '@/domain'
import { checkPathAccessibility, execFile } from '@/utils'

type LoadVideosMetadataSuccessResult = [VideosMetadata, null]
type LoadVideosMetadataFailureResult = [null, Error]
export type LoadVideosMetadataResult = Promise<
  LoadVideosMetadataSuccessResult | LoadVideosMetadataFailureResult
>

export type GenerateVideoSegmentsDTO = {
  videoFilePath: string
  videoSegmentsDirectory: string
  sizeInBytes: number
  durationInSeconds: number
}

export type GetVideoSegmentsDirectoryDTO = {
  videosDirectory: string
  videoFileNameWithoutExtension: string
}

export class VideosService {
  segmentsDirectory = 'segments'
  acceptedVideoFormats = ['.mp4']

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

  async deleteVideoSegments(videoSegmentsDirectory: string): Promise<void> {
    const videoSegmentsDirectoryAcessibility = await checkPathAccessibility(videoSegmentsDirectory)
    if (videoSegmentsDirectoryAcessibility === 'UNACCESSIBLE') {
      throw new Error(
        `Video segments directory "${videoSegmentsDirectory}" isn't accessible; check its permissions and try again`
      )
    }

    if (videoSegmentsDirectoryAcessibility === 'OK') {
      await fs.rm(videoSegmentsDirectory, { force: true, recursive: true })
    }

    return
  }

  async generateVideoSegments(dto: GenerateVideoSegmentsDTO): Promise<void> {
    const { videoFilePath, videoSegmentsDirectory, sizeInBytes, durationInSeconds } = dto

    const { name: videoFileNameWithoutExtension, ext: videoFileExtension } =
      path.parse(videoFilePath)

    const maxSizePerFileInBytes = 1792 * 1024 * 1024 // 1.75GB in MB * 1 MB in KB * 1 KB in B

    const numberOfFiles = Math.ceil(sizeInBytes / maxSizePerFileInBytes)

    const durationOfEachFileInSeconds = durationInSeconds / numberOfFiles

    const videoSegmentsDirectoryAccessibility = await checkPathAccessibility(videoSegmentsDirectory)

    if (videoSegmentsDirectoryAccessibility === 'UNACCESSIBLE') {
      throw new Error(
        `Video segments directory "${videoSegmentsDirectory}" isn't accessible; check its permissions and try again`
      )
    }

    if (videoSegmentsDirectoryAccessibility === 'INEXISTENT') {
      await fs.mkdir(videoSegmentsDirectory, { recursive: true })
    }

    if (sizeInBytes <= maxSizePerFileInBytes) {
      stepsLogger.info('Original file size is under upload limits; using symlink...')

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
      ffmpegCommandOutputFilePath
    ]

    await execFile('ffmpeg', ffmpegCommandArgs)
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
      throw new Error(`Unexpected missing width of file "${videoFilePath}"`)
    }

    if (!heightString) {
      throw new Error(`Unexpected missing height of file "${videoFilePath}"`)
    }

    if (!durationInSecondsString) {
      throw new Error(`Unexpected missing duration of file "${videoFilePath}"`)
    }

    const width = Number.parseInt(widthString, 10)
    if (!Number.isFinite(width)) {
      throw new Error(`Unexpected infinite width of file "${videoFilePath}"`)
    }

    const height = Number.parseInt(heightString, 10)
    if (!Number.isFinite(height)) {
      throw new Error(`Unexpected infinite height of file "${videoFilePath}"`)
    }

    const durationInSeconds = Number.parseFloat(durationInSecondsString)
    if (!Number.isFinite(durationInSeconds)) {
      throw new Error(`Unexpected infinite duration of file "${videoFilePath}"`)
    }

    return {
      width,
      height,
      durationInSeconds,
      sizeInBytes
    }
  }

  getVideoSegmentsDirectory(dto: GetVideoSegmentsDirectoryDTO): string {
    const { videosDirectory, videoFileNameWithoutExtension } = dto

    const videoSegmentsDirectory = path.resolve(
      videosDirectory,
      this.segmentsDirectory,
      videoFileNameWithoutExtension
    )

    return videoSegmentsDirectory
  }

  async listVideosFileNames(videosDirectory: string): Promise<Array<string>> {
    const videosDirectoryStatus = await checkPathAccessibility(videosDirectory)
    if (videosDirectoryStatus === 'INEXISTENT') {
      throw new Error(`Videos directory "${videosDirectory}" doesn't exist`)
    }

    if (videosDirectoryStatus === 'UNACCESSIBLE') {
      throw new Error(
        `Videos directory "${videosDirectory}" isn't accessible; check its permissions and try again`
      )
    }

    const fileNames = await fs.readdir(videosDirectory)

    const videosFileNames = fileNames.filter(fileName =>
      this.acceptedVideoFormats.some(format => fileName.endsWith(format))
    )

    return videosFileNames
  }

  async listVideoSegmentsFileNames(videoSegmentsDirectory: string): Promise<Array<string>> {
    const fileNames = await fs.readdir(videoSegmentsDirectory)

    const segmentsFileNames = fileNames.filter(fileName =>
      this.acceptedVideoFormats.some(format => fileName.endsWith(format))
    )

    return segmentsFileNames
  }

  async loadVideosMetadata(videosDirectory: string): Promise<LoadVideosMetadataResult> {
    // Hard-coded "videos.json" since there is no option to customize that in the present moment
    const metadataPath = path.join(videosDirectory, 'videos.json')

    const metadataAccessibility = await checkPathAccessibility(metadataPath)
    if (metadataAccessibility === 'INEXISTENT') {
      return [[], null]
    }

    if (metadataAccessibility === 'UNACCESSIBLE') {
      return [null, new Error(`Videos metadata path "${metadataPath}" isn't accessible`)]
    }

    const metadataBuffer = await fs.readFile(metadataPath)
    const metadataObject = JSON.parse(metadataBuffer.toString())

    const metadataValidationResult = videosMetadataSchema.safeParse(metadataObject)
    if (!metadataValidationResult.success) {
      const [issue] = metadataValidationResult.error.issues
      if (!issue) {
        throw new Error('Unexpected videosMetadataSchema validation error')
      }

      return [null, new Error(issue.message)]
    }

    return [metadataValidationResult.data, null]
  }
}
