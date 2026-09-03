import type {
  CLIAutocompleteContract,
  CLIConfirmContract,
  CLIInputContract,
  CLILoadingContract,
  CLIPrintStepContract,
  CLIProgressContract,
  CLISelectContract,
  CLIPrintWarnContract
} from './cli'

export interface CLIService
  extends CLIAutocompleteContract,
    CLIConfirmContract,
    CLIInputContract,
    CLILoadingContract,
    CLIPrintStepContract,
    CLIProgressContract,
    CLISelectContract,
    CLIPrintWarnContract {}
