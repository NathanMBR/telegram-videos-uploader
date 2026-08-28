import { z as zod } from 'zod'

import { getSchemaErrorMessage } from './core'
import type { VideoAvailabilities } from './VideoAvailabilities'

const errorMessageSchema = 'video metadata'

export const videoAvailabilityEnumSchema = zod.enum(
  ['public', 'private', 'unlisted', 'subscriber_only', 'premium_only', 'needs_auth'],
  { error: getSchemaErrorMessage(errorMessageSchema, 'availability') }
)

export const videoMetadataSchema = zod.object(
  {
    title: zod.string({ error: getSchemaErrorMessage(errorMessageSchema, 'title') }),
    filename: zod.string({ error: getSchemaErrorMessage(errorMessageSchema, 'filename') }),
    description: zod
      .string({ error: getSchemaErrorMessage(errorMessageSchema, 'description') })
      .default(''),
    webpage_url: zod.string({ error: getSchemaErrorMessage(errorMessageSchema, 'webpage_url') }),
    availability: videoAvailabilityEnumSchema,
    upload_date: zod.string({ error: getSchemaErrorMessage(errorMessageSchema, 'upload_date') })
  },
  { error: 'Invalid metadata object' }
)

export const videosMetadataSchema = zod.array(videoMetadataSchema, {
  error: 'Invalid metadata array'
})

export type VideoMetadata = zod.output<typeof videoMetadataSchema>
export type VideosMetadata = zod.output<typeof videosMetadataSchema>

export namespace VideoMetadata {
  export const transformMetadataAvailability = (
    availability: VideoMetadata['availability']
  ): VideoAvailabilities => {
    const availabilityTransformer: Record<VideoMetadata['availability'], VideoAvailabilities> = {
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

  export const transformMetadataUploadDate = (uploadDate: string): Date | null => {
    if (!uploadDate) {
      return null
    }

    const date = new Date(`${uploadDate}T00:00`)
    if (Number.isNaN(date.getTime())) {
      return null
    }

    return date
  }
}
