export namespace CLIPrintErrorContract {
  export type Request = Array<string>

  export type Response = void
}

export interface CLIPrintErrorContract {
  printError(...request: CLIPrintErrorContract.Request): CLIPrintErrorContract.Response
}
