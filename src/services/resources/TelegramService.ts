import fs from 'node:fs'
import path from 'node:path'

import { Agent, FormData, fetch } from 'undici'

import { defaultVideoAvailability, type VideoAvailabilities } from '@/db'
import {
  defaultPostDescriptionDateFormat,
  type PostDescriptionAvailabilities,
  type PostDescriptionDateFormats
} from '@/domain'
import { ImplementationError, UsageError } from '@/errors'
import { execFile } from '@/utils'

import type { TelegramAPI } from '../data'

export namespace TelegramService {
  export type Constructor = {
    apiBaseUrl: string
    botToken: string
  }

  export type DeleteMessagesDTO = {
    channelId: string
    messagesIds: Array<number>
  }

  export type ExtractVideoCoverDTO = {
    videoSegmentPath: string
    durationInSeconds: number
  }

  export type GetChatDataReturn = {
    title: string
    type: string
    description: string | null
  }

  export type GetSelfDataReturn = {
    firstName: string
    lastName: string | null
    username: string
  }

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

  export type UploadVideoToChannelReturn = {
    messageId: number
    uploadedAt: Date
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

  async deleteMessage(dto: { channelId: string; messageId: number }): Promise<void> {
    const deleteMessageUrl = new URL(
      `/bot${this.settings.botToken}/deleteMessage`,
      this.settings.apiBaseUrl
    )

    const deleteMessageBody = {
      chat_id: dto.channelId,
      message_id: dto.messageId
    }

    const deleteMessageFetchResponse = await fetch(deleteMessageUrl, {
      method: 'POST',
      body: JSON.stringify(deleteMessageBody),
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const deleteMessageResponse =
      (await deleteMessageFetchResponse.json()) as TelegramAPI.DeleteMessageResponse

    if (!deleteMessageResponse.ok) {
      throw new UsageError(
        `Telegram error while deleting Telegram message with ID ${dto.messageId}: ${deleteMessageResponse.description}`
      )
    }
  }

  async deleteMessages(dto: TelegramService.DeleteMessagesDTO): Promise<void> {
    const deleteMessagesUrl = new URL(
      `/bot${this.settings.botToken}/deleteMessages`,
      this.settings.apiBaseUrl
    )

    const deleteVideoBody = {
      chat_id: dto.channelId,
      message_ids: dto.messagesIds
    }

    const deleteMessagesFetchResponse = await fetch(deleteMessagesUrl, {
      method: 'POST',
      body: JSON.stringify(deleteVideoBody),
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const deleteMessagesResponse =
      (await deleteMessagesFetchResponse.json()) as TelegramAPI.DeleteMessagesResponse

    if (!deleteMessagesResponse.ok) {
      throw new UsageError(
        `Telegram error while deleting Telegram messages with IDs: ${dto.messagesIds.join(' ')} --> ${deleteMessagesResponse.description}`
      )
    }
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

  async getChatData(chatId: string): Promise<TelegramService.GetChatDataReturn> {
    const getChatUrl = new URL(`/bot${this.settings.botToken}/getChat`, this.settings.apiBaseUrl)

    getChatUrl.searchParams.append('chat_id', chatId)

    const getChatFetchResponse = await fetch(getChatUrl)
    const getChatResponse = (await getChatFetchResponse.json()) as TelegramAPI.GetChatResponse
    if (!getChatResponse.ok) {
      throw new UsageError(getChatResponse.description)
    }

    const chatData: TelegramService.GetChatDataReturn = {
      title: String(getChatResponse.result.title),
      type: String(getChatResponse.result.type),
      description: getChatResponse.result.description
        ? String(getChatResponse.result.description)
        : null
    }

    return chatData
  }

  async getSelfData(): Promise<TelegramService.GetSelfDataReturn> {
    const getMeUrl = new URL(`/bot${this.settings.botToken}/getMe`, this.settings.apiBaseUrl)

    const getMeFetchResponse = await fetch(getMeUrl)
    const getMeResponse = (await getMeFetchResponse.json()) as TelegramAPI.GetMeResponse
    if (!getMeResponse.ok) {
      throw new UsageError(getMeResponse.description)
    }

    const selfData: TelegramService.GetSelfDataReturn = {
      firstName: getMeResponse.result.first_name,
      lastName: getMeResponse.result.last_name || null,
      username: getMeResponse.result.username
    }

    return selfData
  }

  async runHealthCheck(): Promise<boolean> {
    try {
      const telegramGetMeUrl = new URL(
        `/bot${this.settings.botToken}/getMe`,
        this.settings.apiBaseUrl
      )

      const getMeFetchResponse = await fetch(telegramGetMeUrl)

      const getMeResponse = (await getMeFetchResponse.json()) as TelegramAPI.GetMeResponse

      const isHealthy = getMeFetchResponse.ok && getMeResponse.ok
      return isHealthy
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

  async uploadVideoToChannel(
    dto: TelegramService.UploadVideoToChannelDTO
  ): Promise<TelegramService.UploadVideoToChannelReturn> {
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

    const sendVideoUrl = new URL(
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

    const sendVideoFetchResponse = await fetch(sendVideoUrl, {
      method: 'POST',
      body: sendVideoFormData,
      dispatcher
    })

    const sendVideoResponse = (await sendVideoFetchResponse.json()) as TelegramAPI.SendVideoResponse
    if (!sendVideoResponse.ok) {
      throw new UsageError(sendVideoResponse.description)
    }

    const uploadedAt = new Date(sendVideoResponse.result.date * 1_000)
    if (Number.isNaN(uploadedAt.getTime())) {
      throw new ImplementationError('Invalid date returned from Telegram post')
    }

    return {
      messageId: sendVideoResponse.result.message_id,
      uploadedAt
    }
  }
}
