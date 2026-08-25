export class ImplementationError extends Error {
  constructor(public readonly message: string) {
    super(message)
  }
}
