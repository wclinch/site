'use client'
import ResearchBrowser from './ResearchBrowser'
import AskSitePanel from './AskSitePanel'

export default function RightPanel({ isFocused, onFocusToggle, askSiteOpen }: {
  isFocused?: boolean
  onFocusToggle?: () => void
  askSiteOpen?: boolean
}) {
  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', padding: '7px', gap: askSiteOpen ? '7px' : 0,
      WebkitAppRegion: 'no-drag',
    } as React.CSSProperties}>

      {/* Ask Site — top, grows from 0 to equal share */}
      <div style={{
        flexGrow: askSiteOpen ? 0.8 : 0,
        flexShrink: 1,
        flexBasis: 0,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        transition: 'flex-grow 0.22s ease',
      }}>
        <AskSitePanel />
      </div>

      {/* Web — always flex:1, shrinks to share when Ask Site opens */}
      <div style={{
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        minHeight: 0,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <ResearchBrowser isFocused={isFocused} onFocusToggle={onFocusToggle} askSiteOpen={askSiteOpen} />
      </div>
    </div>
  )
}
