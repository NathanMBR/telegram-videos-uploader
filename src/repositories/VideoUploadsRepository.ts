import { asc, count, eq, isNull } from 'drizzle-orm'

import { DrizzleConnection, type VideoUpload, videosTable, videoUploadsTable } from '@/db'
import { ImplementationError } from '@/errors'

export class VideoUploadsRepository {
  private readonly drizzle = DrizzleConnection.instance

  constructor(private readonly origin: string | null | undefined) {}

  async getAll(videoId?: VideoUpload['videoId']): Promise<Array<VideoUpload>> {
    const videoUploads = await this.drizzle
      .select()
      .from(videoUploadsTable)
      .where(videoId ? eq(videoUploadsTable.videoId, videoId) : undefined)
      .orderBy(asc(videoUploadsTable.id))

    return videoUploads
  }

  async save(videoUploadDto: VideoUpload.New): Promise<VideoUpload> {
    const [videoUpload] = await this.drizzle
      .insert(videoUploadsTable)
      .values(videoUploadDto)
      .returning()

    if (!videoUpload) {
      throw new ImplementationError(
        `Unable to save VideoUpload with telegramPostId "${videoUploadDto.telegramPostId}" in the database`
      )
    }

    return videoUpload
  }

  async count(): Promise<number> {
    const [result] = await this.drizzle
      .select({ count: count() })
      .from(videoUploadsTable)
      .innerJoin(videosTable, eq(videoUploadsTable.videoId, videosTable.id))
      .where(
        this.origin === null
          ? isNull(videosTable.origin)
          : this.origin
            ? eq(videosTable.origin, this.origin)
            : undefined
      )

    if (!result) {
      throw new ImplementationError('Unable to count videoUploads')
    }

    return result.count
  }

  async countParts(): Promise<Array<{ part: number; count: number }>> {
    const result = await this.drizzle
      .select({ part: videoUploadsTable.part, count: count() })
      .from(videoUploadsTable)
      .innerJoin(videosTable, eq(videoUploadsTable.videoId, videosTable.id))
      .where(
        this.origin === null
          ? isNull(videosTable.origin)
          : this.origin
            ? eq(videosTable.origin, this.origin)
            : undefined
      )
      .groupBy(videoUploadsTable.part)
      .orderBy(asc(videoUploadsTable.part))

    return result
  }
}
