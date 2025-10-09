/**
 * Network Detector Module
 * Detects network paths and provides optimal settings
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'

const execAsync = promisify(exec)

export class NetworkDetector {
  async isNetworkPath(targetPath: string): Promise<boolean> {
    const normalizedPath = path.resolve(targetPath)

    if (process.platform === 'win32') {
      return this.isWindowsNetworkPath(normalizedPath)
    } else {
      return this.isUnixNetworkPath(normalizedPath)
    }
  }

  private async isWindowsNetworkPath(targetPath: string): Promise<boolean> {
    // UNC path
    if (targetPath.startsWith('\\\\')) {
      return true
    }

    // Check if drive letter is mapped to network
    try {
      const drive = targetPath.substring(0, 2)
      const { stdout } = await execAsync(`net use ${drive}`)
      return stdout.toLowerCase().includes('remote')
    } catch {
      return false
    }
  }

  private async isUnixNetworkPath(targetPath: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`df -T "${targetPath}"`)
      const networkFS = ['nfs', 'smb', 'cifs', 'sshfs', 'afp']
      return networkFS.some((fs) => stdout.toLowerCase().includes(fs))
    } catch {
      return false
    }
  }

  /**
   * Get optimal transfer settings for network paths
   */
  getNetworkTransferSettings(): {
    bufferSize: number
    maxRetries: number
    retryDelay: number
    progressThrottle: number
  } {
    return {
      bufferSize: 1 * 1024 * 1024, // 1MB for network
      maxRetries: 5,
      retryDelay: 2000,
      progressThrottle: 500 // Less frequent updates
    }
  }
}
