export namespace CLIPrintStepContract {
  export type Request = Array<string>

  export type Response = void
}

export interface CLIPrintStepContract {
  printStep(...request: CLIPrintStepContract.Request): CLIPrintStepContract.Response
}
