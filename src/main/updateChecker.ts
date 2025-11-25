/**
 * Update Checker Module
 * Fetches latest release from GitHub and compares with current version
 */

import { app } from 'electron'
import https from 'https'
import { VersionUtils } from '../shared/utils/versionUtils'
import { getLogger } from './logger'

/** GitHub repository for releases */
const GITHUB_REPO = 'StoneCotton/transferboxJS'
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`

/** Cache duration in milliseconds (1 hour) */
const CACHE_DURATION_MS = 60 * 60 * 1000

/** Update check result */
export interface UpdateCheckResult {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string
  releaseUrl: string
  releaseNotes: string | null
  publishedAt: string | null
}

/** Cached update check result */
interface CachedResult {
  result: UpdateCheckResult
  timestamp: number
}

/** Module-level cache */
let cachedResult: CachedResult | null = null

/**
 * Parse version string, removing 'v' prefix if present
 */
function parseVersion(tagName: string): string {
  return tagName.startsWith('v') ? tagName.substring(1) : tagName
}

/**
 * Fetch data from a URL using Node's https module
 */
function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': `TransferBox/${app.getVersion()}`,
          Accept: 'application/vnd.github.v3+json'
        }
      },
      (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            fetchJson<T>(redirectUrl).then(resolve).catch(reject)
            return
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`GitHub API returned status ${response.statusCode}`))
          return
        }

        let data = ''
        response.on('data', (chunk) => {
          data += chunk
        })
        response.on('end', () => {
          try {
            const parsed = JSON.parse(data) as T
            resolve(parsed)
          } catch {
            reject(new Error('Failed to parse GitHub API response'))
          }
        })
      }
    )

    request.on('error', (error) => {
      reject(error)
    })

    // Set timeout for the request
    request.setTimeout(10000, () => {
      request.destroy()
      reject(new Error('GitHub API request timed out'))
    })
  })
}

/**
 * GitHub release API response shape (partial)
 */
interface GitHubRelease {
  tag_name: string
  html_url: string
  body: string | null
  published_at: string | null
  draft: boolean
  prerelease: boolean
}

/**
 * Check for updates from GitHub releases
 * Results are cached for 1 hour to avoid excessive API calls
 *
 * @param forceRefresh - If true, bypass cache and fetch fresh data
 * @returns Update check result
 */
export async function checkForUpdates(forceRefresh = false): Promise<UpdateCheckResult> {
  const logger = getLogger()
  const currentVersion = app.getVersion()

  // Check cache first (unless force refresh)
  if (!forceRefresh && cachedResult) {
    const cacheAge = Date.now() - cachedResult.timestamp
    if (cacheAge < CACHE_DURATION_MS) {
      logger.debug('Using cached update check result', {
        cacheAgeMinutes: Math.round(cacheAge / 60000)
      })
      return cachedResult.result
    }
  }

  logger.info('Checking for updates', { currentVersion })

  try {
    const release = await fetchJson<GitHubRelease>(GITHUB_API_URL)

    const latestVersion = parseVersion(release.tag_name)

    // Compare versions: if latest > current, update is available
    const comparison = VersionUtils.compare(latestVersion, currentVersion)
    const hasUpdate = comparison > 0

    const result: UpdateCheckResult = {
      hasUpdate,
      currentVersion,
      latestVersion,
      releaseUrl: release.html_url || GITHUB_RELEASES_URL,
      releaseNotes: release.body,
      publishedAt: release.published_at
    }

    // Cache the result
    cachedResult = {
      result,
      timestamp: Date.now()
    }

    logger.info('Update check complete', {
      currentVersion,
      latestVersion,
      hasUpdate
    })

    return result
  } catch (error) {
    logger.warn('Failed to check for updates', {
      error: error instanceof Error ? error.message : String(error)
    })

    // Return a "no update" result on error so the app isn't blocked
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      releaseUrl: GITHUB_RELEASES_URL,
      releaseNotes: null,
      publishedAt: null
    }
  }
}

/**
 * Get the GitHub releases URL
 */
export function getReleasesUrl(): string {
  return GITHUB_RELEASES_URL
}

/**
 * Clear the cached update check result
 * Useful for testing or forcing a fresh check
 */
export function clearUpdateCache(): void {
  cachedResult = null
  getLogger().debug('Update cache cleared')
}
