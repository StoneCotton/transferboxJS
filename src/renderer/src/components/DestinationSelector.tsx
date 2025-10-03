/**
 * Destination Selector Component
 */

import { FolderOpen, CheckCircle2, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { useUIStore } from '../store'
import { useIpc } from '../hooks/useIpc'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card'
import { Button } from './ui/Button'
import { cn } from '../lib/utils'

export function DestinationSelector() {
  const { selectedDestination, setSelectedDestination, isSelectingDestination } = useUIStore()
  const ipc = useIpc()
  const [isValidating, setIsValidating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSelectFolder = async () => {
    try {
      const folder = await ipc.selectFolder()
      if (folder) {
        setIsValidating(true)
        setValidationError(null)

        // Validate the path
        const validation = await ipc.validatePath({ path: folder })

        if (validation.isValid) {
          setSelectedDestination(folder)
          setValidationError(null)
        } else {
          setValidationError(validation.error || 'Invalid destination')
          setSelectedDestination(null)
        }
      }
    } catch (error) {
      console.error('Failed to select folder:', error)
      setValidationError('Failed to select folder')
    } finally {
      setIsValidating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transfer Destination</CardTitle>
        <CardDescription>Choose where to save transferred files</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Selected Path Display */}
          {selectedDestination ? (
            <div
              className={cn(
                'rounded-lg border p-4',
                validationError
                  ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950'
                  : 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950'
              )}
            >
              <div className="flex items-start gap-3">
                {validationError ? (
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      validationError
                        ? 'text-red-900 dark:text-red-100'
                        : 'text-green-900 dark:text-green-100'
                    )}
                  >
                    {validationError ? 'Invalid Destination' : 'Destination Ready'}
                  </p>
                  <p
                    className={cn(
                      'mt-1 text-sm break-all',
                      validationError
                        ? 'text-red-700 dark:text-red-300'
                        : 'text-green-700 dark:text-green-300'
                    )}
                  >
                    {selectedDestination}
                  </p>
                  {validationError && (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">{validationError}</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-800">
              <FolderOpen className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600" />
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                No destination selected
              </p>
            </div>
          )}

          {/* Select Button */}
          <Button
            onClick={handleSelectFolder}
            disabled={isValidating || isSelectingDestination}
            className="w-full"
            size="lg"
          >
            <FolderOpen className="mr-2 h-5 w-5" />
            {isValidating
              ? 'Validating...'
              : selectedDestination
                ? 'Change Destination'
                : 'Select Destination'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
