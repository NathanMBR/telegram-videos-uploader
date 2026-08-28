import * as cli from '@inquirer/prompts'

import { stepsLogger } from '@/config'
import { ImplementationError, UserExitError } from '@/errors'
import type {
  CLIAutocompleteContract,
  CLIConfirmContract,
  CLIInputContract,
  CLIPrintContract,
  CLISelectContract
} from '@/services'

export class InquirerCLIService
  implements
    CLIAutocompleteContract,
    CLIConfirmContract,
    CLIPrintContract,
    CLISelectContract,
    CLIInputContract
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

  async input(request: CLIInputContract.Request): Promise<CLIInputContract.Response> {
    try {
      const { message, validator, isOptional, default: defaultValue } = request

      const result = await cli.input({
        message,
        required: !isOptional,
        default: defaultValue,
        prefill: defaultValue ? 'editable' : 'tab',
        validate: async (input: string) => {
          if (!validator) {
            return true
          }

          const validationResult = await validator(input)
          if (!validationResult) {
            return true
          }

          return validationResult
        }
      })

      return result
    } catch (error: unknown) {
      throw this.handleInquirerError(error)
    }
  }

  public print(...request: CLIPrintContract.Request): CLIPrintContract.Response {
    const message = request.join('\n')

    stepsLogger.info(message)
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
    } catch (error: unknown) {
      throw this.handleInquirerError(error)
    }
  }
}
