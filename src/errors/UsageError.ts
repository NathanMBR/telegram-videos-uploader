export class UsageError extends Error {
  constructor(public readonly message: string) {
    super(message)
  }
}
