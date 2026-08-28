export namespace CLIInputContract {
  export type Request = {
    message: string
    isOptional?: boolean
    default?: string
    validator?: (input: string) => boolean | string | Promise<boolean | string>
  }

  export type Response = string
}

export interface CLIInputContract {
  input(request: CLIInputContract.Request): Promise<CLIInputContract.Response>
}
