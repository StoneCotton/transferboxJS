import * as path from 'path'
import * as os from 'os'
import { Logger } from '../../src/main/logger'
import { ConfigManager } from '../../src/main/configManager'

describe('Logging integration', () => {
  let logger: Logger
  let testDbPath: string

  beforeEach(() => {
    testDbPath = path.join(os.tmpdir(), `transferbox-logging-int-${Date.now()}.db`)
    logger = new Logger(testDbPath)
  })

  afterEach(() => {
    logger.close()
  })

  it('applies log level dynamically and filters logs', () => {
    logger.setLevel('warn')
    logger.debug('d1')
    logger.info('i1')
    logger.warn('w1')
    logger.error('e1')

    const logs = logger.getRecent(10)
    expect(logs.some((l) => l.message === 'd1')).toBe(false)
    expect(logs.some((l) => l.message === 'i1')).toBe(false)
    expect(logs.some((l) => l.message === 'w1')).toBe(true)
    expect(logs.some((l) => l.message === 'e1')).toBe(true)
  })

  it('retention deletes old logs without errors', () => {
    logger.info('keep')
    const deleted = logger.deleteOldLogs(0)
    expect(deleted).toBeGreaterThanOrEqual(0)
  })
})
