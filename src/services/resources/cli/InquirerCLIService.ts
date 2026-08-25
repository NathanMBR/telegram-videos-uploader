import * as cli from '@inquirer/prompts'

import { ImplementationError, UserExitError } from '@/errors'
import type { CLIAutocompleteContract, CLIConfirmContract, CLISelectContract } from '@/services'

export class InquirerCLIService
  implements CLIAutocompleteContract, CLIConfirmContract, CLISelectContract
{
  private handleInquirerError(error: unknown): Error {
    if (error instanceof Error) {
      if (error.name === 'ExitPromptError') {
        return new UserExitError()
      }

      return new ImplementationError(error.message)
    }

    return new ImplementationError(String(error))
  }

  async autocomplete<T>(
    request: CLIAutocompleteContract.Request<T>
  ): Promise<CLIAutocompleteContract.Response<T>> {
    try {
      const result = await cli.search({
        message: request.message,
        source: async input => {
          const options = await request.getOptions(input)

          return options.map(option => ({
            name: option.label,
            value: option.value
          }))
        }
      })

      return result
    } catch (error: unknown) {
      throw this.handleInquirerError(error)
    }
  }

  async confirm(request: CLIConfirmContract.Request): Promise<CLIConfirmContract.Response> {
    try {
      const result = await cli.confirm({
        message: request.message,
        default: typeof request.default === 'undefined' ? true : request.default
      })

      return result
    } catch (error: unknown) {
      throw this.handleInquirerError(error)
    }
  }

  async select<T>(request: CLISelectContract.Request<T>): Promise<CLISelectContract.Response<T>> {
    try {
      const { message, options } = request

      const result = await cli.select({
        message,
        choices: options.map(option => ({ name: option.label, value: option.value })),
        pageSize: 15
      })

      return result
    } catch (error) {
      throw this.handleInquirerError(error)
    }
  }
}
