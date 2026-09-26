export class UsageError extends Error {
  public static isInstance(error: Error): error is UsageError {
    return error instanceof UsageError
  }

  constructor(
    public readonly message: string,
    public readonly allowRetry = false
  ) {
    super(message)
  }
}
