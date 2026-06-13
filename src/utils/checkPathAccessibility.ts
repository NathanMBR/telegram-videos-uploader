import fs from 'node:fs/promises'

export type CheckPathAccessibilityResult = 'INEXISTENT' | 'UNACCESSIBLE' | 'OK'

export const checkPathAccessibility = async (
  path: string,
  mode?: number
): Promise<CheckPathAccessibilityResult> => {
  try {
    await fs.access(path, mode)

    return 'OK'
  } catch (error: unknown) {
    const checkPathAccessibilityUnknownError = new Error('Unexpected checkPathAccessibility error')

    if (!error) {
      throw checkPathAccessibilityUnknownError
    }

    const isInstanceOfError = error instanceof Error
    if (!isInstanceOfError) {
      throw checkPathAccessibilityUnknownError
    }

    const errorHasCodeProperty = 'code' in error
    if (!errorHasCodeProperty) {
      throw checkPathAccessibilityUnknownError
    }

    if (error.code === 'ENOENT') {
      return 'INEXISTENT'
    }

    if (error.code === 'EACCES') {
      return 'UNACCESSIBLE'
    }

    throw checkPathAccessibilityUnknownError
  }
}
