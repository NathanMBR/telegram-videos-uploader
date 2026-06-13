import { eq } from 'drizzle-orm'

import { drizzle, type NewVideo, type Video, videosTable } from '@/db'
import type { VideoMetadata } from '@/domain'

export class VideosRepository {
  transformMetadataUploadDate(uploadDate: string): Date {
    return new Date(`${uploadDate}T00:00`)
  }

  transformMetadataAvailability(
    availability: VideoMetadata['availability']
  ): Video['availability'] {
    const availabilityTransformer: Record<VideoMetadata['availability'], Video['availability']> = {
      needs_auth: 'NEEDS_AUTH',
      premium_only: 'PREMIUM_ONLY',
      private: 'PRIVATE',
      public: 'PUBLIC',
      subscriber_only: 'MEMBERS_ONLY',
      unlisted: 'UNLISTED'
    }

    const transformedAvailability = availabilityTransformer[availability] || 'UNKNOWN'
    return transformedAvailability
  }

  async getByFilename(fileName: Video['filename']): Promise<Video | undefined> {
    const [video] = await drizzle
      .select()
      .from(videosTable)
      .where(eq(videosTable.filename, fileName))

    return video
  }

  async save(videoDto: NewVideo): Promise<Video> {
    const [video] = await drizzle.insert(videosTable).values(videoDto).returning()
    if (!video) {
      throw new Error(`Unable to save Video with filename "${videoDto.filename}" in the database`)
    }

    return video
  }

  async setUploadedStatusById(id: Video['id']): Promise<void> {
    await drizzle.update(videosTable).set({ status: 'UPLOADED' }).where(eq(videosTable.id, id))
  }
}
