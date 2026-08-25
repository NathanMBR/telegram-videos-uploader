import { logger } from '@/config'

import { UsageError } from './UsageError'
import { UserExitError } from './UserExitError'

export const handleError = (error: unknown): number => {
  const isError = error instanceof Error
  if (!isError) {
    logger.fatal(`Unknown error: ${String(error)}`)
    return 1
  }

  if (error instanceof UserExitError) {
    return 0
  }

  if (error instanceof UsageError) {
    logger.error(error.message)
    return 0
  }

  logger.fatal(error.message)
  return 1
}
