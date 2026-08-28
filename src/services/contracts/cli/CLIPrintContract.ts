export namespace CLIPrintContract {
  export type Request = Array<string>

  export type Response = void
}

export interface CLIPrintContract {
  print(...request: CLIPrintContract.Request): CLIPrintContract.Response
}
