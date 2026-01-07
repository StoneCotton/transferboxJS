/**
 * Dialog Service
 * Centralizes dialog management for consistent user prompts
 */

import { dialog, BrowserWindow } from 'electron'

/**
 * Result of the transfer in progress dialog
 */
export type TransferDialogResult = 'quit' | 'continue'

/**
 * Options for confirmation dialogs
 */
export interface ConfirmationDialogOptions {
  type: 'none' | 'info' | 'error' | 'question' | 'warning'
  title: string
  message: string
  detail?: string
  buttons: string[]
  defaultId?: number
  cancelId?: number
}

/**
 * Dialog Service
 * Provides standardized dialogs for the application
 */
export class DialogService {
  /**
   * Show a dialog warning that a transfer is in progress
   * Used when user tries to close window or quit app during a transfer
   * @param window - The parent window for the dialog
   * @param context - Context for the dialog message ('closing' or 'quitting')
   * @returns 'quit' if user wants to cancel transfer and quit, 'continue' otherwise
   */
  async showTransferInProgressDialog(
    window: BrowserWindow,
    context: 'closing' | 'quitting' = 'closing'
  ): Promise<TransferDialogResult> {
    const detail =
      context === 'closing'
        ? 'Closing the application will cancel the transfer. Are you sure you want to quit?'
        : 'Quitting the application will cancel the transfer. Are you sure you want to quit?'

    const result = await dialog.showMessageBox(window, {
      type: 'warning',
      title: 'Transfer in Progress',
      message: 'A file transfer is currently in progress.',
      detail,
      buttons: ['Cancel Transfer & Quit', 'Keep Transfer Running'],
      defaultId: 1, // Default to "Keep Transfer Running"
      cancelId: 1 // ESC key will select "Keep Transfer Running"
    })

    return result.response === 0 ? 'quit' : 'continue'
  }

  /**
   * Show a generic confirmation dialog
   * @param window - The parent window for the dialog
   * @param options - Dialog options
   * @returns The index of the button that was clicked
   */
  async showConfirmationDialog(
    window: BrowserWindow,
    options: ConfirmationDialogOptions
  ): Promise<number> {
    const result = await dialog.showMessageBox(window, {
      type: options.type,
      title: options.title,
      message: options.message,
      detail: options.detail,
      buttons: options.buttons,
      defaultId: options.defaultId ?? 0,
      cancelId: options.cancelId ?? options.buttons.length - 1
    })

    return result.response
  }

  /**
   * Show an error dialog
   * @param window - The parent window for the dialog
   * @param title - Dialog title
   * @param message - Error message
   * @param detail - Additional details
   */
  async showErrorDialog(
    window: BrowserWindow,
    title: string,
    message: string,
    detail?: string
  ): Promise<void> {
    await dialog.showMessageBox(window, {
      type: 'error',
      title,
      message,
      detail,
      buttons: ['OK']
    })
  }

  /**
   * Show an info dialog
   * @param window - The parent window for the dialog
   * @param title - Dialog title
   * @param message - Info message
   * @param detail - Additional details
   */
  async showInfoDialog(
    window: BrowserWindow,
    title: string,
    message: string,
    detail?: string
  ): Promise<void> {
    await dialog.showMessageBox(window, {
      type: 'info',
      title,
      message,
      detail,
      buttons: ['OK']
    })
  }
}

// Singleton instance
let dialogServiceInstance: DialogService | null = null

/**
 * Get the singleton DialogService instance
 */
export function getDialogService(): DialogService {
  if (!dialogServiceInstance) {
    dialogServiceInstance = new DialogService()
  }
  return dialogServiceInstance
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetDialogService(): void {
  dialogServiceInstance = null
}
