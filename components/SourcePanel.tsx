'use client'
import SourceStack from './SourceStack'

export default function SourcePanel({ width, hidden }: { width: number | string; hidden?: boolean }) {
  return (
    <div style={{
      width: hidden ? 0 : width, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', WebkitAppRegion: 'no-drag',
      transition: 'width 0.22s ease',
    } as React.CSSProperties}>
      <div style={{ flex: 1, minHeight: 0, padding: '7px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <SourceStack />
      </div>
    </div>
  )
}
