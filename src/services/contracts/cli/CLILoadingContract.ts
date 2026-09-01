export namespace CLILoadingContract {
  export type Request = {
    loadingMessage: string
    doneMessage: string
  }

  export type Response = {
    start: () => void
    stop: () => void
  }
}

export interface CLILoadingContract {
  loading(request: CLILoadingContract.Request): CLILoadingContract.Response
}
