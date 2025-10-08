/**
 * Sound Manager
 * Handles audio playback for success and error events
 */

import errorSoundFile from '../assets/error.mp3'
import successSoundFile from '../assets/success.mp3'

// Preload audio files to avoid delays
let errorSound: HTMLAudioElement | null = null
let successSound: HTMLAudioElement | null = null

/**
 * Initialize sound manager by preloading audio files
 * Call this once during app initialization
 */
export function initSoundManager(): void {
  try {
    // Create audio elements with imported file paths
    // Vite will handle the bundling and provide the correct paths
    errorSound = new Audio(errorSoundFile)
    successSound = new Audio(successSoundFile)

    // Preload the audio files
    errorSound.load()
    successSound.load()

    console.log('[SoundManager] Initialized successfully')
  } catch (error) {
    console.error('[SoundManager] Failed to initialize:', error)
  }
}

/**
 * Play error sound
 * Use for: transfer failures, cancellations, invalid files, errors
 */
export function playErrorSound(): void {
  try {
    if (errorSound) {
      // Reset to beginning in case it was already playing
      errorSound.currentTime = 0
      errorSound.play().catch((err) => {
        console.error('[SoundManager] Failed to play error sound:', err)
      })
    }
  } catch (error) {
    console.error('[SoundManager] Error playing error sound:', error)
  }
}

/**
 * Play success sound
 * Use for: successful transfers with no errors
 */
export function playSuccessSound(): void {
  try {
    if (successSound) {
      // Reset to beginning in case it was already playing
      successSound.currentTime = 0
      successSound.play().catch((err) => {
        console.error('[SoundManager] Failed to play success sound:', err)
      })
    }
  } catch (error) {
    console.error('[SoundManager] Error playing success sound:', error)
  }
}

/**
 * Cleanup sound manager resources
 * Call this when the app is closing
 */
export function cleanupSoundManager(): void {
  try {
    if (errorSound) {
      errorSound.pause()
      errorSound = null
    }
    if (successSound) {
      successSound.pause()
      successSound = null
    }
    console.log('[SoundManager] Cleaned up successfully')
  } catch (error) {
    console.error('[SoundManager] Error during cleanup:', error)
  }
}
