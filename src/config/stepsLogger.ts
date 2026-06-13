import pino from 'pino'

export const stepsLogger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'time,pid,hostname,level'
    }
  }
})
