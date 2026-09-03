import childProcess from 'node:child_process'

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

      return reject(code)
    })
  })
