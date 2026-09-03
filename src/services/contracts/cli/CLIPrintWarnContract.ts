export namespace CLIPrintWarnContract {
  export type Request = Array<string>

  export type Response = void
}

export interface CLIPrintWarnContract {
  printWarn(...request: CLIPrintWarnContract.Request): CLIPrintWarnContract.Response
}
