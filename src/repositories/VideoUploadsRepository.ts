import { asc, eq } from 'drizzle-orm'

import { DrizzleConnection, type VideoUpload, videoUploadsTable } from '@/db'

export class VideoUploadsRepository {
  private readonly drizzle = DrizzleConnection.instance

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
      throw new Error(
        `Unable to save VideoUpload with telegramPostId "${videoUploadDto.telegramPostId}" in the database`
      )
    }

    return videoUpload
  }
}
