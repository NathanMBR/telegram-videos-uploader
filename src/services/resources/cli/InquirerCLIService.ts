import * as cli from '@inquirer/prompts'

import type { CLIAutocompleteContract, CLIConfirmContract, CLISelectContract } from '@/services'

export class InquirerCLIService
  implements CLIAutocompleteContract, CLIConfirmContract, CLISelectContract
{
  async autocomplete<T>(
    request: CLIAutocompleteContract.Request<T>
  ): Promise<CLIAutocompleteContract.Response<T>> {
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
  }

  async confirm(request: CLIConfirmContract.Request): Promise<CLIConfirmContract.Response> {
    const result = await cli.confirm({
      message: request.message,
      default: typeof request.default === 'undefined' ? true : request.default
    })

    return result
  }

  async select<T>(request: CLISelectContract.Request<T>): Promise<CLISelectContract.Response<T>> {
    const { message, options } = request

    const result = await cli.select({
      message,
      choices: options.map(option => ({ name: option.label, value: option.value }))
    })

    return result
  }
}
