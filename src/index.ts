import { handleError } from '@/errors'
import { boot } from '@/main'

boot()
  .catch((error: unknown) => {
    const exitCode = handleError(error)
    process.exitCode = exitCode
  })
  .finally(process.exit)
