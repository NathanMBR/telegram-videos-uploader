import childProcess from 'node:child_process'
import { ImplementationError } from '@/errors'

export type SpawnRequest = {
  command: string
  args?: Array<string>
  onData?: (buffer: Buffer) => void | Promise<void>
}

export const spawn = async (request: SpawnRequest) =>
  new Promise<void>((resolve, reject) => {
    const { command, args, onData } = request

    const spawned = childProcess.spawn(command, args)

    if (onData) {
      spawned.stdout.on('data', onData)
    }

    spawned.on('close', code => {
      if (code === 0) {
        return resolve()
      }

      return reject(
        new ImplementationError(
          `Spawn exited with error code ${code} while running command: ${command} ${args?.join(' ') || ''}`
        )
      )
    })
  })
