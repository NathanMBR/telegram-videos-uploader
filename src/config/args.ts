import path from 'node:path'
import utils from 'node:util'

export const { values: args } = utils.parseArgs({
  options: {
    presetsPath: {
      type: 'string',
      short: 'p',
      default: path.join(process.cwd(), 'presets.json')
    }
  }
})
