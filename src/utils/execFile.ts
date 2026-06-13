import childProcess from 'node:child_process'

export const execFile = async (command: string, args: Array<string>) =>
  new Promise<string>((resolve, reject) => {
    childProcess.execFile(command, args, (error, stdout) => {
      if (error) {
        return reject(error)
      }

      return resolve(stdout)
    })
  })
