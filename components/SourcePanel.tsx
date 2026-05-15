'use client'
import SourceStack from './SourceStack'

export default function SourcePanel({ width }: { width: number | string }) {
  return (
    <div style={{ width, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, minHeight: 0, padding: '5px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <SourceStack />
      </div>
    </div>
  )
}
