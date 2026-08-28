export const videoAvailabilities = [
  'UNKNOWN',
  'PUBLIC',
  'MEMBERS_ONLY',
  'PRIVATE',
  'UNLISTED',
  'PREMIUM_ONLY',
  'NEEDS_AUTH'
] as const
export type VideoAvailabilities = (typeof videoAvailabilities)[number]
