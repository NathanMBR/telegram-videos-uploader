import { logger } from '@/config'
import { boot } from '@/main'

const main = async (): Promise<number> => {
  try {
    await boot()

    return 0
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      return 0
    }

    logger.fatal(error)

    return 1
  }
}

main()
  .then(exitCode => {
    process.exitCode = exitCode
  })
  .catch(error => {
    process.exitCode = 1

    logger.fatal(error)
  })
  .finally(process.exit)
