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
  CLISelectContract
} from './cli'

export interface CLIService
  extends CLIAutocompleteContract,
    CLIConfirmContract,
    CLIInputContract,
    CLILoadingContract,
    CLIPrintErrorContract,
    CLIPrintInfoContract,
    CLIPrintStepContract,
    CLIPrintSuccessContract,
    CLIPrintWarnContract,
    CLIProgressContract,
    CLISelectContract {}
