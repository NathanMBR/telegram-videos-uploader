import { z as zod } from 'zod'

import { getSchemaErrorMessage } from './core'

export const postDescriptionDateFormats = [
  'YYYY-MM-DD',
  'YYYY/MM/DD',
  'DD-MM-YYYY',
  'DD/MM/YYYY',
  'MM-DD-YYYY',
  'MM/DD/YYYY'
] as const
export type PostDescriptionDateFormats = (typeof postDescriptionDateFormats)[number]
export const defaultPostDescriptionDateFormat = 'MM/DD/YYYY' satisfies PostDescriptionDateFormats

export const defaultPostDescriptionAvailability = {
  private: 'Private',
  premiumOnly: 'Only for YouTube Premium users',
  subscriberOnly: 'Only for channel members',
  needsAuth: 'Public (requires login)',
  unlisted: 'Unlisted',
  public: 'Public',
  unknown: 'Unknown'
}
export type PostDescriptionAvailabilities = Record<
  keyof typeof defaultPostDescriptionAvailability,
  string
>

const errorMessageSchema = 'preset'

export const presetSchema = zod.object(
  {
    name: zod.string({ error: getSchemaErrorMessage(errorMessageSchema, 'name') }),

    origin: zod.string({ error: getSchemaErrorMessage(errorMessageSchema, 'origin') }).nullish(),

    databaseUrl: zod.string({ error: getSchemaErrorMessage(errorMessageSchema, 'databaseUrl') }),

    telegram: zod.object(
      {
        apiBaseUrl: zod.string({
          error: getSchemaErrorMessage(errorMessageSchema, 'telegram.apiBaseUrl')
        }),

        botToken: zod.string({
          error: getSchemaErrorMessage(errorMessageSchema, 'telegram.botToken')
        }),

        channelId: zod.string({
          error: getSchemaErrorMessage(errorMessageSchema, 'telegram.channelId')
        })
      },
      { error: getSchemaErrorMessage(errorMessageSchema, 'telegram') }
    ),

    videosDirectory: zod.string({
      error: getSchemaErrorMessage(errorMessageSchema, 'videosDirectory')
    }),

    postDescription: zod.object(
      {
        baseText: zod
          .union([
            zod.string({
              error: getSchemaErrorMessage(errorMessageSchema, 'postDescription.baseText')
            }),
            zod
              .array(
                zod.string({
                  error: getSchemaErrorMessage(errorMessageSchema, 'postDescription.baseText[]')
                }),
                {
                  error: getSchemaErrorMessage(errorMessageSchema, 'postDescription.baseText')
                }
              )
              .transform(array => array.join('\n'))
          ])
          .default(''),

        channel: zod.object(
          {
            name: zod
              .string({
                error: getSchemaErrorMessage(errorMessageSchema, 'postDescription.channel.name')
              })
              .default(''),

            url: zod
              .string({
                error: getSchemaErrorMessage(errorMessageSchema, 'postDescription.channel.url')
              })
              .default('')
          },
          { error: getSchemaErrorMessage(errorMessageSchema, 'postDescription.channel') }
        ),

        dateFormat: zod
          .enum(postDescriptionDateFormats, {
            error: getSchemaErrorMessage(errorMessageSchema, 'postDescription.dateFormats')
          })
          .default(defaultPostDescriptionDateFormat),

        availability: zod
          .object(
            {
              private: zod
                .string({
                  error: getSchemaErrorMessage(
                    errorMessageSchema,
                    'postDescription.availability.private'
                  )
                })
                .default(defaultPostDescriptionAvailability.private),

              premiumOnly: zod
                .string({
                  error: getSchemaErrorMessage(
                    errorMessageSchema,
                    'postDescription.availability.premiumOnly'
                  )
                })
                .default(defaultPostDescriptionAvailability.premiumOnly),

              subscriberOnly: zod
                .string({
                  error: getSchemaErrorMessage(
                    errorMessageSchema,
                    'postDescription.availability.subscriberOnly'
                  )
                })
                .default(defaultPostDescriptionAvailability.subscriberOnly),

              needsAuth: zod
                .string({
                  error: getSchemaErrorMessage(
                    errorMessageSchema,
                    'postDescription.availability.needsAuth'
                  )
                })
                .default(defaultPostDescriptionAvailability.needsAuth),

              unlisted: zod
                .string({
                  error: getSchemaErrorMessage(
                    errorMessageSchema,
                    'postDescription.availability.unlisted'
                  )
                })
                .default(defaultPostDescriptionAvailability.unlisted),

              public: zod
                .string({
                  error: getSchemaErrorMessage(
                    errorMessageSchema,
                    'postDescription.availability.public'
                  )
                })
                .default(defaultPostDescriptionAvailability.public),

              unknown: zod
                .string({
                  error: getSchemaErrorMessage(
                    errorMessageSchema,
                    'postDescription.availability.unknown'
                  )
                })
                .default(defaultPostDescriptionAvailability.unknown)
            },
            { error: getSchemaErrorMessage(errorMessageSchema, 'postDescription.availability') }
          )
          .default(defaultPostDescriptionAvailability)
      },
      { error: getSchemaErrorMessage(errorMessageSchema, 'postDescription') }
    )
  },
  { error: 'Invalid preset object' }
)

export const presetsSchema = zod.array(presetSchema, { error: 'Invalid presets array' })

export type Preset = zod.output<typeof presetSchema>
export type Presets = zod.output<typeof presetsSchema>
