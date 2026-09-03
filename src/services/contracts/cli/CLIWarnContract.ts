export namespace CLIWarnContract {
  export type Request = Array<string>

  export type Response = void
}

export interface CLIWarnContract {
  warn(...request: CLIWarnContract.Request): CLIWarnContract.Response
}
