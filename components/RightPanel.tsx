'use client'
import ResearchBrowser from './ResearchBrowser'

export default function RightPanel() {
  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', padding: '5px',
    }}>
      <ResearchBrowser />
    </div>
  )
}
