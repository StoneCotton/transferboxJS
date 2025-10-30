/**
 * Network Detector Module
 * Detects network paths and provides optimal settings
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'

const execFileAsync = promisify(execFile)

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
      // Validate drive letter format (e.g., "C:")
      const driveLetter = drive.replace(/[\\/:]/g, '').toUpperCase()
      if (!/^[A-Z]$/.test(driveLetter)) {
        return false
      }
      // Use execFile with array arguments to prevent command injection
      const { stdout } = await execFileAsync('net', ['use', `${driveLetter}:`])
      return stdout.toLowerCase().includes('remote')
    } catch {
      return false
    }
  }

  private async isUnixNetworkPath(targetPath: string): Promise<boolean> {
    try {
      // Validate path doesn't contain command injection characters
      if (/[;&|`$(){}]/.test(targetPath)) {
        return false
      }
      // Use execFile with array arguments to prevent command injection
      const { stdout } = await execFileAsync('df', ['-T', targetPath])
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
