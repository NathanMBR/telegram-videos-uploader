export namespace CLIConfirmContract {
  export type Request = {
    message: string
    default?: boolean
  }

  export type Response = boolean
}

export interface CLIConfirmContract {
  confirm(request: CLIConfirmContract.Request): Promise<CLIConfirmContract.Response>
}
