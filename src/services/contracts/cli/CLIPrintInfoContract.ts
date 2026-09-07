export namespace CLIPrintInfoContract {
  export type Request = Array<string>

  export type Response = void
}

export interface CLIPrintInfoContract {
  printInfo(...request: CLIPrintInfoContract.Request): CLIPrintInfoContract.Response
}
