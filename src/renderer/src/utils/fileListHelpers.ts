/**
 * FileList Helper Functions
 * Utility functions for the FileList component
 */

import { File, FileVideo, FileAudio, FileImage, FileType, type LucideIcon } from 'lucide-react'

// File extension constants
const VIDEO_EXTENSIONS = [
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.mts',
  '.m2ts',
  '.m4v',
  '.mpg',
  '.mpeg',
  '.crm',
  '.mxf',
  '.webm',
  '.braw',
  '.r3d'
]

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.aac', '.m4a']

const IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.raw',
  '.cr2',
  '.cr3',
  '.nef',
  '.arw',
  '.dng',
  '.heic',
  '.heif'
]

const XML_EXTENSIONS = ['.xml']

export type FileCategory = 'video' | 'audio' | 'image' | 'other'
export type FileTransferStatus =
  | 'pending'
  | 'transferring'
  | 'verifying'
  | 'complete'
  | 'error'
  | 'skipped'

/**
 * Get the appropriate icon component for a file based on its extension
 */
export function getFileIcon(filePath: string): LucideIcon {
  const ext = `.${filePath.toLowerCase().split('.').pop()}`

  if (VIDEO_EXTENSIONS.includes(ext)) {
    return FileVideo
  }
  if (AUDIO_EXTENSIONS.includes(ext)) {
    return FileAudio
  }
  if (IMAGE_EXTENSIONS.includes(ext)) {
    return FileImage
  }
  if (XML_EXTENSIONS.includes(ext)) {
    return FileType
  }
  return File
}

/**
 * Get the file type category based on its extension
 */
export function getFileType(filePath: string): FileCategory {
  const ext = `.${filePath.toLowerCase().split('.').pop()}`

  if (VIDEO_EXTENSIONS.includes(ext)) {
    return 'video'
  }
  if (AUDIO_EXTENSIONS.includes(ext)) {
    return 'audio'
  }
  if (IMAGE_EXTENSIONS.includes(ext)) {
    return 'image'
  }
  return 'other'
}

interface ProgressFile {
  sourcePath: string
  status?: string
  checksum?: string
  duration?: number
}

interface TransferProgress {
  activeFiles?: ProgressFile[]
  currentFile?: ProgressFile
  completedFiles?: ProgressFile[]
}

/**
 * Get the transfer status for a specific file
 */
export function getFileTransferStatus(filePath: string, progress: unknown): FileTransferStatus {
  if (!progress || typeof progress !== 'object' || progress === null) {
    return 'pending'
  }

  const progressObj = progress as TransferProgress

  // Check if file is in completed files first
  if (progressObj.completedFiles) {
    const completedFile = progressObj.completedFiles.find((file) => file.sourcePath === filePath)
    if (completedFile) {
      return completedFile.status as FileTransferStatus
    }
  }

  // Check if file is currently being transferred
  if (progressObj.currentFile && progressObj.currentFile.sourcePath === filePath) {
    return progressObj.currentFile.status as FileTransferStatus
  }

  // Check if file is in active files (parallel transfers)
  if (progressObj.activeFiles) {
    const activeFile = progressObj.activeFiles.find((file) => file.sourcePath === filePath)
    if (activeFile) {
      return activeFile.status as FileTransferStatus
    }
  }

  return 'pending'
}

/**
 * Get the checksum for a completed file
 */
export function getFileChecksum(filePath: string, progress: unknown): string | null {
  if (!progress || typeof progress !== 'object' || progress === null) {
    return null
  }

  const progressObj = progress as TransferProgress

  // Check completed files first (most likely to have checksums)
  if (progressObj.completedFiles) {
    const completedFile = progressObj.completedFiles.find((file) => file.sourcePath === filePath)
    if (completedFile?.checksum) {
      return completedFile.checksum
    }
  }

  // Check current file
  if (
    progressObj.currentFile &&
    progressObj.currentFile.sourcePath === filePath &&
    progressObj.currentFile.checksum
  ) {
    return progressObj.currentFile.checksum
  }

  // Check active files
  if (progressObj.activeFiles) {
    const activeFile = progressObj.activeFiles.find((file) => file.sourcePath === filePath)
    if (activeFile?.checksum) {
      return activeFile.checksum
    }
  }

  return null
}

/**
 * Get the elapsed time for a file transfer
 */
export function getFileElapsedTime(filePath: string, progress: unknown): number | null {
  if (!progress || typeof progress !== 'object' || progress === null) {
    return null
  }

  const progressObj = progress as TransferProgress

  // Check if file is currently being transferred
  if (progressObj.currentFile && progressObj.currentFile.sourcePath === filePath) {
    return progressObj.currentFile.duration || null
  }

  // Check if file is in active files (parallel transfers)
  if (progressObj.activeFiles) {
    const activeFile = progressObj.activeFiles.find((file) => file.sourcePath === filePath)
    if (activeFile?.duration) {
      return activeFile.duration
    }
  }

  // Check if file is in completed files
  if (progressObj.completedFiles) {
    const completedFile = progressObj.completedFiles.find((file) => file.sourcePath === filePath)
    if (completedFile?.duration) {
      return completedFile.duration
    }
  }

  return null
}

/**
 * Copy text to clipboard
 */
export function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch((err) => {
    console.error('Failed to copy to clipboard:', err)
  })
}
