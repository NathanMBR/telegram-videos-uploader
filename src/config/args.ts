import path from 'node:path'
import utils from 'node:util'

export const { values: args } = utils.parseArgs({
  options: {
    settingsPath: {
      type: 'string',
      short: 's',
      default: path.join(process.cwd(), 'settings.json')
    },
    dryRun: {
      type: 'boolean',
      short: 'd',
      default: false
    }
  }
})
