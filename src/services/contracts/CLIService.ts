import type {
  CLIAutocompleteContract,
  CLIConfirmContract,
  CLIInputContract,
  CLILoadingContract,
  CLIPrintContract,
  CLIProgressContract,
  CLISelectContract,
  CLIWarnContract
} from './cli'

export interface CLIService
  extends CLIAutocompleteContract,
    CLIConfirmContract,
    CLIInputContract,
    CLILoadingContract,
    CLIPrintContract,
    CLIProgressContract,
    CLISelectContract,
    CLIWarnContract {}
