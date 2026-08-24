import { logger } from '@/config'
import type { Preset } from './Preset'

export namespace Usecase {
  export type ExecuteReturn = 'OK' | 'BACK'
}

export abstract class Usecase {
  public abstract readonly actionTitle: string
  public abstract readonly preset: Preset

  public printDryRunMessage(): void {
    logger.warn('Dry run enabled; skipping...')
  }

  public abstract execute(): Promise<Usecase.ExecuteReturn>
}
