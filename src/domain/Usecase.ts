import { logger } from '@/config'
import type { Preset } from './Preset'

export abstract class Usecase {
  public abstract readonly actionTitle: string
  public abstract readonly preset: Preset

  public printDryRunMessage() {
    logger.warn('Dry run enabled; skipping...')
  }

  public abstract execute(): Promise<void>
}
