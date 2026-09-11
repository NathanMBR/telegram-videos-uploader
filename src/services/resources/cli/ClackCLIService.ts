import * as cli from '@clack/prompts'
import picocolors from 'picocolors'

import { UsageError, UserExitError } from '@/errors'
import type {
  CLIAutocompleteContract,
  CLIConfirmContract,
  CLIInputContract,
  CLILoadingContract,
  CLIPrintErrorContract,
  CLIPrintInfoContract,
  CLIPrintStepContract,
  CLIPrintSuccessContract,
  CLIPrintWarnContract,
  CLIProgressContract,
  CLISelectContract,
  CLIService
} from '@/services'

export class ClackCLIService implements CLIService {
  constructor() {
    // biome-ignore lint/suspicious/noConsole: easiest way to clear the screen
    console.clear()
    cli.intro(picocolors.inverse('Telegram Videos Uploader'))
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
      initialValue: defaultValue || '',
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
    const { loadingMessage, doneMessage, cancelMessage } = request

    const spinner = cli.spinner()

    return {
      start: (message?: string) => spinner.start(message || loadingMessage || 'Started'),
      stop: (message?: string) => spinner.stop(message || doneMessage || 'Stopped'),
      cancel: (message?: string) => spinner.cancel(message || cancelMessage || 'Cancelled')
    }
  }

  public printError(...request: CLIPrintErrorContract.Request): CLIPrintErrorContract.Response {
    const message = request.join('\n')

    cli.log.error(message)
  }

  public printInfo(...request: CLIPrintInfoContract.Request): CLIPrintInfoContract.Response {
    const message = request.join('\n')

    cli.log.info(message)
  }

  public printStep(...request: CLIPrintStepContract.Request): CLIPrintStepContract.Response {
    const message = request.join('\n')

    cli.log.step(message)
  }

  public printSuccess(
    ...request: CLIPrintSuccessContract.Request
  ): CLIPrintSuccessContract.Response {
    const message = request.join('\n')

    cli.log.success(message)
  }

  public printWarn(...request: CLIPrintWarnContract.Request): CLIPrintWarnContract.Response {
    const message = request.join('\n')

    cli.log.warn(message)
  }

  public progress(request: CLIProgressContract.Request): CLIProgressContract.Response {
    const { initialMessage, progressMax = 100 } = request

    const progress = cli.progress({ style: 'block', max: progressMax })
    progress.start(initialMessage)

    return {
      changeMessage: progress.message,
      addToProgress: progress.advance,
      cancel: progress.cancel,
      finish: progress.stop
    }
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
