export namespace CLIPrintSuccessContract {
  export type Request = Array<string>

  export type Response = void
}

export interface CLIPrintSuccessContract {
  printSuccess(...request: CLIPrintSuccessContract.Request): CLIPrintSuccessContract.Response
}
