export namespace CLILoadingContract {
  export type Request = {
    loadingMessage?: string
    doneMessage?: string
    cancelMessage?: string
  }

  export type Response = {
    start: (message?: string) => void
    stop: (message?: string) => void
    cancel: (message?: string) => void
  }
}

export interface CLILoadingContract {
  loading(request: CLILoadingContract.Request): CLILoadingContract.Response
}
