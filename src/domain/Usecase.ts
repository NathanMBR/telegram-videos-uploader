import type { Preset } from './Preset'

export interface Usecase {
  preset: Preset

  execute(): Promise<void>
}
