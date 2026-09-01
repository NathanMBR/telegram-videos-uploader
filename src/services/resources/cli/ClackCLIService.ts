import * as cli from '@clack/prompts'

import { UsageError, UserExitError } from '@/errors'
import type {
  CLIAutocompleteContract,
  CLIConfirmContract,
  CLIInputContract,
  CLILoadingContract,
  CLIPrintContract,
  CLISelectContract
} from '@/services'

export class ClackCLIService
  implements
    CLIAutocompleteContract,
    CLIConfirmContract,
    CLIInputContract,
    CLILoadingContract,
    CLIPrintContract,
    CLISelectContract
{
  constructor() {
    cli.intro('Telegram Videos Uploader')
  }

  private handleClackCancel() {
    cli.cancel('Canceled')
    return new UserExitError()
  }

  async autocomplete<T>(
    request: CLIAutocompleteContract.Request<T>
  ): Promise<CLIAutocompleteContract.Response<T>> {
    const { message, getOptions } = request

    const options = await getOptions('')

    const result = await cli.autocomplete({
      message,
      options: options.map(option => ({
        label: option.label,
        value: {
          value: option.value
        }
      }))
    })

    if (cli.isCancel(result)) {
      throw this.handleClackCancel()
    }

    return result.value
  }

  async confirm(request: CLIConfirmContract.Request): Promise<CLIConfirmContract.Response> {
    const { message, default: defaultValue } = request

    const result = await cli.confirm({
      message,
      initialValue: !!defaultValue
    })

    if (cli.isCancel(result)) {
      throw this.handleClackCancel()
    }

    return result
  }

  async input(request: CLIInputContract.Request): Promise<CLIInputContract.Response> {
    const { message, default: defaultValue, validator } = request

    const result = await cli.text({
      message,
      defaultValue: defaultValue || '',
      validate: input => {
        if (!validator) {
          return undefined
        }

        const validationResult = validator(input || '')
        if (typeof validationResult === 'string' && validationResult) {
          return new UsageError(validationResult)
        }

        if (!validationResult) {
          return new UsageError('Invalid input')
        }

        return undefined
      }
    })

    if (cli.isCancel(result)) {
      throw this.handleClackCancel()
    }

    return result
  }

  public loading(request: CLILoadingContract.Request): CLILoadingContract.Response {
    const { loadingMessage, doneMessage } = request

    const spinner = cli.spinner()

    return {
      start: () => spinner.start(loadingMessage),
      stop: () => spinner.stop(doneMessage)
    }
  }

  public print(...request: CLIPrintContract.Request): CLIPrintContract.Response {
    const message = request.join('\n')

    cli.log.step(message)
  }

  async select<T>(request: CLISelectContract.Request<T>): Promise<CLISelectContract.Response<T>> {
    const { message, options } = request

    const result = await cli.select({
      message,
      options: options.map(option => ({
        label: option.label,
        value: {
          value: option.value
        }
      }))
    })

    if (cli.isCancel(result)) {
      throw this.handleClackCancel()
    }

    return result.value
  }
}
