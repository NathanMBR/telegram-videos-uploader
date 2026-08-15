import { asc, eq, like, or } from 'drizzle-orm'

import { DrizzleConnection, type Video, videosTable } from '@/db'

export class VideosRepository {
  private readonly drizzle = DrizzleConnection.instance

  async getAll(search: string = ''): Promise<Array<Video>> {
    const videos = await this.drizzle
      .select()
      .from(videosTable)
      .where(
        search
          ? or(
              like(videosTable.filename, `%${search}%`),
              like(videosTable.title, `%${search}%`),
              like(videosTable.description, `%${search}%`)
            )
          : undefined
      )
      .orderBy(asc(videosTable.title))

    return videos
  }

  async deleteFromId(id: Video['id']): Promise<void> {
    await this.drizzle.delete(videosTable).where(eq(videosTable.id, id))
  }

  async getByFilename(fileName: Video['filename']): Promise<Video | undefined> {
    const [video] = await this.drizzle
      .select()
      .from(videosTable)
      .where(eq(videosTable.filename, fileName))

    return video
  }

  async save(videoDto: Video.New): Promise<Video> {
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
