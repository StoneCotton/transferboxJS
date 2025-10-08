# Drive Mount Status Feature

## Overview

Fixed a bug where unmounted drives were still displayed in the Source Drive card after transfer completion. The drive would only disappear when physically disconnected. This implementation adds proper visual states for drives based on their mount status.

## Visual States Implemented

The DriveSelector component now displays four distinct visual states:

### 1. **Mounted & Selected** (Active)

- **Appearance**: Bright brand gradient (green/orange), bold text
- **Badge**: Green checkmark icon
- **Border**: Brand-500 color
- **Behavior**: Drive is mounted and currently selected for transfer

### 2. **Mounted & Deselected** (Available)

- **Appearance**: White/gray background, normal text
- **Badge**: Clock icon (if existing drive in auto mode)
- **Border**: Gray-200 color
- **Behavior**: Drive is mounted and available for selection

### 3. **Unmounted** (Unavailable)

- **Appearance**: Red/orange gradient with reduced opacity, strikethrough effect
- **Badge**: Red PowerOff icon
- **Border**: Red-300 color
- **Status**: "(Unmounted)" label in title
- **Message**: "Drive unmounted - please reconnect to use"
- **Behavior**: Button is disabled, cannot be selected

### 4. **Disconnected** (Removed)

- **Appearance**: Not shown (removed from list)
- **Behavior**: Drive is physically removed from the system

## Technical Implementation

### 1. IPC Communication

**File**: `src/shared/types/ipc.ts`

- Added `DRIVE_UNMOUNTED` IPC channel for unmount events

### 2. State Management

**Files**:

- `src/renderer/src/store/types.ts`
- `src/renderer/src/store/slices/driveSlice.ts`
- `src/renderer/src/store/index.ts`

Added state tracking:

- `unmountedDrives: Set<string>` - Tracks drives that are unmounted but still connected
- `markDriveAsUnmounted(device: string)` - Action to mark a drive as unmounted
- `isDriveUnmounted(device: string)` - Selector to check if a drive is unmounted

### 3. Main Process

**File**: `src/main/ipc.ts`

- Modified `DRIVE_UNMOUNT` handler to emit `DRIVE_UNMOUNTED` event after successful unmount
- Added event emission in auto-unmount after transfer completion
- Store window reference to send unmount notifications

### 4. Preload Bridge

**Files**:

- `src/preload/index.ts`
- `src/preload/index.d.ts`

Added IPC bridge:

- `onDriveUnmounted(callback)` - Event listener for unmount notifications

### 5. Renderer Hooks

**Files**:

- `src/renderer/src/hooks/useIpc.ts`
- `src/renderer/src/hooks/useAppInit.ts`

Added:

- `onDriveUnmounted` in IPC API interface
- Event listener in useAppInit to handle unmount events and update state

### 6. UI Component

**File**: `src/renderer/src/components/DriveSelector.tsx`

Changes:

- Import `PowerOff` icon from lucide-react
- Get `isDriveUnmounted` from drive store
- Add unmounted drive check in `handleSelectDrive` to prevent selection
- Add `disabled` prop to drive buttons when unmounted
- Conditional styling based on mount status:
  - Red gradient background for unmounted drives
  - Red icon background for unmounted drives
  - Red text colors for unmounted drives
  - PowerOff badge indicator
  - "(Unmounted)" label in title
  - Status message below drive info
- Set `opacity-70` and `cursor-not-allowed` for unmounted drives

## User Experience

### Before

1. Transfer completes → Drive unmounts
2. Drive stays visible in UI as selectable (just deselected)
3. User can click on unmounted drive (causing errors)
4. Drive only disappears when physically disconnected

### After

1. Transfer completes → Drive unmounts
2. Drive immediately shows unmounted state with red styling
3. Button is disabled - user cannot select unmounted drive
4. Clear visual feedback: PowerOff icon, red colors, "(Unmounted)" label
5. Drive stays visible until physically removed (for user awareness)
6. When physically disconnected, drive is removed from list

## Benefits

1. **Clear Visual Feedback**: Users immediately know which drives are unmounted
2. **Error Prevention**: Disabled state prevents attempts to use unmounted drives
3. **User Awareness**: Drive remains visible so users know it's ready to be physically removed
4. **Professional UX**: Smooth transitions between states with proper visual hierarchy
5. **Accessibility**: Color is not the only indicator - text labels and icons provide context

## Testing Recommendations

1. Transfer files from a drive
2. Verify drive shows unmounted state immediately after successful transfer
3. Verify unmounted drive cannot be selected
4. Physically disconnect the drive
5. Verify drive is removed from the list
6. Reconnect the drive
7. Verify it appears as mounted and selectable

## Future Enhancements

- Add animation when transitioning between mount states
- Add tooltip explaining why drive is unmounted
- Add "Remount" button for unmounted drives (if supported by OS)
- Add notification sound when drive enters unmounted state
