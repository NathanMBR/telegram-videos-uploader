import pino from 'pino'
import pinoPretty from 'pino-pretty'

const stream = pinoPretty({
  colorize: true,
  ignore: 'time,pid,hostname,level',
  sync: true
})

export const stepsLogger = pino(stream)
