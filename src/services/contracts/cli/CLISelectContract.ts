import type { Option } from './core'

export namespace CLISelectContract {
  export type Request<T> = {
    message: string
    options: Array<Option<T>>
  }

  export type Response<T> = T
}

export interface CLISelectContract {
  select<T>(request: CLISelectContract.Request<T>): Promise<CLISelectContract.Response<T>>
}
