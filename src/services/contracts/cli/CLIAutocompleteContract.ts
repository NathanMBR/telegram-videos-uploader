import type { Option } from './core'

export namespace CLIAutocompleteContract {
  export type Request<T> = {
    message: string
    getOptions: (input?: string) => Array<Option<T>> | Promise<Array<Option<T>>>
  }

  export type Response<T> = T
}

export interface CLIAutocompleteContract {
  autocomplete<T>(
    request: CLIAutocompleteContract.Request<T>
  ): Promise<CLIAutocompleteContract.Response<T>>
}
