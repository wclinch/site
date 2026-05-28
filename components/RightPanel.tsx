'use client'
import ResearchBrowser from './ResearchBrowser'

export default function RightPanel({ isFocused, onFocusToggle }: {
  isFocused?: boolean
  onFocusToggle?: () => void
}) {
  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', padding: '7px',
      WebkitAppRegion: 'no-drag',
    } as React.CSSProperties}>
      <ResearchBrowser isFocused={isFocused} onFocusToggle={onFocusToggle} />
    </div>
  )
}
