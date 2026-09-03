export namespace CLIProgressContract {
  export type Request = {
    initialMessage: string
    progressMax?: number
  }

  export type Response = {
    addToProgress: (value: number) => void
    changeMessage: (message: string) => void
    cancel: () => void
    finish: (message: string) => void
  }
}

export interface CLIProgressContract {
  progress(request: CLIProgressContract.Request): CLIProgressContract.Response
}
