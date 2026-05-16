'use client'
import ResearchBrowser from './ResearchBrowser'

export default function RightPanel({ isFocused, onFocusToggle }: {
  isFocused?: boolean
  onFocusToggle?: () => void
}) {
  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', padding: '5px',
    }}>
      <ResearchBrowser isFocused={isFocused} onFocusToggle={onFocusToggle} />
    </div>
  )
}
