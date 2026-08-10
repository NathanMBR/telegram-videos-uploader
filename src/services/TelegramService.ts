import fs from 'node:fs'
import path from 'node:path'

import { Agent, FormData, fetch } from 'undici'

import { defaultVideoAvailability, type VideoAvailabilities } from '@/db'
import {
  defaultPostDescriptionDateFormat,
  type PostDescriptionAvailabilities,
  type PostDescriptionDateFormats
} from '@/domain'
import { execFile } from '@/utils'

export namespace TelegramService {
  export type Constructor = {
    apiBaseUrl: string
    botToken: string
  }

  export type ExtractVideoCoverDTO = {
    videoSegmentPath: string
    durationInSeconds: number
  }

  export type GetChatDataReturn = Promise<{
    title: string
    type: string
    description: string | null
  }>

  export type GetSelfDataReturn = Promise<{
    firstName: string
    lastName: string | null
    username: string
  }>

  export type GetPostDescriptionDTO = {
    baseText: string
    videoTitle: string
    videoUrl: string
    videoDescription: string
    channelTitle: string
    channelUrl: string
    availability: string
    date: string
    partCurrent: string
    partTotal: string
  }

  export type TransformDbAvailabilityDTO = {
    presetAvailabilities: PostDescriptionAvailabilities
    availability: VideoAvailabilities
  }

  export type TransformDbPublishedAtDTO = {
    presetAvailabilities: PostDescriptionAvailabilities
    presetDateFormat: PostDescriptionDateFormats
    publishedAt: Date | null
  }

  export type UploadVideoToChannelDTO = {
    channelId: string
    videoPath: string
    width: number
    height: number
    durationInSeconds: number
    postDescription: string
    videoCoverPath?: string | undefined
    videoThumbnailPath?: string | undefined
  }
}

export class TelegramService {
  constructor(private readonly settings: TelegramService.Constructor) {}

  async convertVideoCoverToThumbnail(videoCoverPath: string): Promise<string> {
    const videoCoverPathParsed = path.parse(videoCoverPath)

    const videoThumbnailPath = path.join(
      videoCoverPathParsed.dir,
      `${videoCoverPathParsed.name}_thumbnail.jpg`
    )

    const ffmpegCommandArgs = [
      '-i',
      videoCoverPath,
      '-vf',
      'scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2',
      '-q:v',
      '3',
      '-y',
      videoThumbnailPath
    ]

    await execFile('ffmpeg', ffmpegCommandArgs)

    return videoThumbnailPath
  }

  async extractVideoCover(dto: TelegramService.ExtractVideoCoverDTO): Promise<string> {
    const { videoSegmentPath, durationInSeconds } = dto

    const videoSegmentPathParsed = path.parse(videoSegmentPath)

    const videoCoverPath = path.join(
      videoSegmentPathParsed.dir,
      `${videoSegmentPathParsed.name}_cover.jpg`
    )

    const halfSegmentDurationInSeconds = durationInSeconds / 2

    const ffmpegCommandArgs = [
      '-ss',
      String(halfSegmentDurationInSeconds),
      '-i',
      videoSegmentPath,
      '-frames:v',
      '1',
      '-update',
      '1',
      '-q:v',
      '2',
      videoCoverPath,
      '-y',
      '-v',
      'error'
    ]

    await execFile('ffmpeg', ffmpegCommandArgs)

    return videoCoverPath
  }

  getPostDescription(dto: TelegramService.GetPostDescriptionDTO): string {
    const {
      baseText,
      videoTitle,
      videoUrl,
      videoDescription,
      channelTitle,
      channelUrl,
      availability,
      date,
      partCurrent,
      partTotal
    } = dto

    const postDescription = baseText
      .replaceAll('#VIDEO_TITLE', videoTitle)
      .replaceAll('#VIDEO_URL', videoUrl)
      .replaceAll('#VIDEO_DESCRIPTION', videoDescription)
      .replaceAll('#CHANNEL_TITLE', channelTitle)
      .replaceAll('#CHANNEL_URL', channelUrl)
      .replaceAll('#AVAILABILITY', availability)
      .replaceAll('#DATE', date)
      .replaceAll('#PART_CURRENT', partCurrent)
      .replaceAll('#PART_TOTAL', partTotal)

    return postDescription
  }

  async getChatData(chatId: string): TelegramService.GetChatDataReturn {
    const telegramGetChatUrl = new URL(
      `/bot${this.settings.botToken}/getChat`,
      this.settings.apiBaseUrl
    )

    telegramGetChatUrl.searchParams.append('chat_id', chatId)

    const fetchResponse = await fetch(telegramGetChatUrl)
    if (!fetchResponse.ok) {
      throw new Error(`Unable to fetch "/getChat" Telegram API for ID "${chatId}"`)
    }

    const jsonResponse = (await fetchResponse.json()) as Record<'result', Record<string, unknown>>

    const chatData: Awaited<TelegramService.GetChatDataReturn> = {
      title: String(jsonResponse.result.title),
      type: String(jsonResponse.result.type),
      description: jsonResponse.result.description ? String(jsonResponse.result.description) : null
    }

    return chatData
  }

  async getSelfData(): TelegramService.GetSelfDataReturn {
    const telegramGetMeUrl = new URL(
      `/bot${this.settings.botToken}/getMe`,
      this.settings.apiBaseUrl
    )

    const fetchResponse = await fetch(telegramGetMeUrl)
    if (!fetchResponse.ok) {
      throw new Error('Unable to fetch "/getMe" Telegram API')
    }

    const jsonResponse = (await fetchResponse.json()) as Record<'result', Record<string, unknown>>

    const selfData: Awaited<TelegramService.GetSelfDataReturn> = {
      firstName: String(jsonResponse.result.first_name),
      lastName: jsonResponse.result.last_name ? String(jsonResponse.result.last_name) : null,
      username: String(jsonResponse.result.username)
    }

    return selfData
  }

  async runHealthCheck(): Promise<boolean> {
    try {
      const telegramGetMeUrl = new URL(
        `/bot${this.settings.botToken}/getMe`,
        this.settings.apiBaseUrl
      )

      const fetchResponse = await fetch(telegramGetMeUrl)

      return fetchResponse.ok
    } catch {
      return false
    }
  }

  transformDbAvailability(dto: TelegramService.TransformDbAvailabilityDTO): string {
    const { presetAvailabilities, availability } = dto

    const availabilityTransformer: Record<VideoAvailabilities, string> = {
      MEMBERS_ONLY: presetAvailabilities.subscriberOnly,
      NEEDS_AUTH: presetAvailabilities.needsAuth,
      PREMIUM_ONLY: presetAvailabilities.premiumOnly,
      PRIVATE: presetAvailabilities.private,
      PUBLIC: presetAvailabilities.public,
      UNLISTED: presetAvailabilities.unlisted,
      UNKNOWN: presetAvailabilities.unknown
    }

    const defaultTransformedAvailability = availabilityTransformer[defaultVideoAvailability]

    const transformedAvailability =
      availabilityTransformer[availability] || defaultTransformedAvailability

    return transformedAvailability
  }

  transformDbPublishedAt(dto: TelegramService.TransformDbPublishedAtDTO): string {
    const { presetAvailabilities, presetDateFormat, publishedAt } = dto

    if (!publishedAt) {
      return presetAvailabilities.unknown
    }

    const year = String(publishedAt.getUTCFullYear())
    const month = String(publishedAt.getUTCMonth() + 1).padStart(2, '0')
    const day = String(publishedAt.getUTCDate()).padStart(2, '0')

    const publishedAtTransformer: Record<PostDescriptionDateFormats, string> = {
      'YYYY-MM-DD': `${year}-${month}-${day}`,
      'YYYY/MM/DD': `${year}/${month}/${day}`,
      'DD-MM-YYYY': `${day}-${month}-${year}`,
      'DD/MM/YYYY': `${day}/${month}/${year}`,
      'MM-DD-YYYY': `${month}-${day}-${year}`,
      'MM/DD/YYYY': `${month}/${day}/${year}`
    }

    const defaultTransformedPublishedAt = publishedAtTransformer[defaultPostDescriptionDateFormat]

    const transformedPublishedAt =
      publishedAtTransformer[presetDateFormat] || defaultTransformedPublishedAt

    return transformedPublishedAt
  }

  async uploadVideoToChannel(dto: TelegramService.UploadVideoToChannelDTO): Promise<void> {
    const {
      channelId,
      videoPath,
      width,
      height,
      durationInSeconds,
      postDescription,
      videoCoverPath,
      videoThumbnailPath
    } = dto

    const telegramSendVideoUrl = new URL(
      `/bot${this.settings.botToken}/sendVideo`,
      this.settings.apiBaseUrl
    )

    const videoBlob = await fs.openAsBlob(videoPath, { type: 'video/mp4' })

    const sendVideoFormData = new FormData()
    sendVideoFormData.append('video', videoBlob, path.basename(videoPath))
    sendVideoFormData.append('chat_id', channelId)
    sendVideoFormData.append('caption', postDescription)
    sendVideoFormData.append('parse_mode', 'MarkdownV2')
    sendVideoFormData.append('width', String(width))
    sendVideoFormData.append('height', String(height))
    sendVideoFormData.append('supports_streaming', 'true')
    sendVideoFormData.append('duration', String(durationInSeconds))

    if (videoCoverPath) {
      const videoCoverBlob = await fs.openAsBlob(videoCoverPath, { type: 'image/jpeg' })

      sendVideoFormData.append('cover', videoCoverBlob, path.basename(videoCoverPath))
    }

    if (videoThumbnailPath) {
      const videoThumbnailBlob = await fs.openAsBlob(videoThumbnailPath, { type: 'image/jpeg' })

      sendVideoFormData.append('thumbnail', videoThumbnailBlob, path.basename(videoThumbnailPath))
    }

    const oneSecondInMilliseconds = 1000
    const oneMinuteInSeconds = 60
    const timeoutInMilliseconds = 15 * oneMinuteInSeconds * oneSecondInMilliseconds

    const dispatcher = new Agent({
      headersTimeout: timeoutInMilliseconds,
      bodyTimeout: timeoutInMilliseconds
    })

    const fetchResponse = await fetch(telegramSendVideoUrl, {
      method: 'POST',
      body: sendVideoFormData,
      dispatcher
    })

    const jsonResponse = await fetchResponse.json()

    if (!fetchResponse.ok) {
      throw new Error(JSON.stringify(jsonResponse, null, 2))
    }
  }
}
