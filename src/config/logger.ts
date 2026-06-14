import pino from 'pino'
import pinoPretty from 'pino-pretty'

const stream = pinoPretty({
  colorize: true,
  ignore: 'time,pid,hostname',
  sync: true
})

export const logger = pino(stream)
