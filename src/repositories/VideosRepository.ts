import { eq } from 'drizzle-orm'

import { DrizzleConnection, type NewVideo, type Video, videosTable } from '@/db'

export class VideosRepository {
  private readonly drizzle = DrizzleConnection.instance

  async getByFilename(fileName: Video['filename']): Promise<Video | undefined> {
    const [video] = await this.drizzle
      .select()
      .from(videosTable)
      .where(eq(videosTable.filename, fileName))

    return video
  }

  async save(videoDto: NewVideo): Promise<Video> {
    const [video] = await this.drizzle.insert(videosTable).values(videoDto).returning()
    if (!video) {
      throw new Error(`Unable to save Video with filename "${videoDto.filename}" in the database`)
    }

    return video
  }

  async setUploadedStatusById(id: Video['id']): Promise<void> {
    await this.drizzle.update(videosTable).set({ status: 'UPLOADED' }).where(eq(videosTable.id, id))
  }
}
