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
    return 1
  }

  let errorMessage = error.message

  if (error.stack) {
    errorMessage += `\n${error.stack}`
  }

  logger.fatal(errorMessage)

  return 1
}
