'use client'
import ResearchBrowser from './ResearchBrowser'
import { ActivityPanel } from './NotificationsPanel'

export default function RightPanel({ isFocused, onFocusToggle, activityOpen }: {
  isFocused?: boolean
  onFocusToggle?: () => void
  activityOpen?: boolean
}) {
  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', padding: '7px', gap: activityOpen ? '7px' : 0,
      WebkitAppRegion: 'no-drag',
    } as React.CSSProperties}>

      {/* Activity — top, grows from 0 to equal share */}
      <div style={{
        flexGrow: activityOpen ? 1 : 0,
        flexShrink: 1,
        flexBasis: 0,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        transition: 'flex-grow 0.22s ease',
      }}>
        <ActivityPanel />
      </div>

      {/* Web — always flex:1, shrinks to share when activity opens */}
      <div style={{
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        minHeight: 0,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <ResearchBrowser isFocused={isFocused} onFocusToggle={onFocusToggle} />
      </div>
    </div>
  )
}
