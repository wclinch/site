'use client'
import { useState } from 'react'
import { useApp } from '@/context/AppContext'

export default function DropZone({ onClose }: { onClose: () => void }) {
  const { uploadFiles } = useApp()
  const [dragOver, setDragOver] = useState(false)

  function handleUpload(files: FileList | File[]) {
    const valid = Array.from(files).filter(f =>
      f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf') ||
      f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name)
    )
    if (valid.length) uploadFiles(valid)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        height: '28px', flexShrink: 0, display: 'flex', alignItems: 'center',
        padding: '0 8px 0 14px', borderBottom: '1px solid #1a1a1a',
      }}>
        <span style={{ flex: 1, fontSize: '10px', color: '#555', letterSpacing: '0.08em', userSelect: 'none' }}>
          Drop zone
        </span>
      </div>

      {/* Drop area */}
      <div
        onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true) } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files) }}
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
          background: dragOver ? '#0d0d0d' : 'transparent',
        }}
      >
        <div style={{
          width: '180px',
          border: `1px dashed ${dragOver ? '#333' : '#1c1c1c'}`,
          borderRadius: '6px', padding: '32px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 0.15s',
        }}>
          <span style={{
            fontSize: '11px', color: dragOver ? '#666' : '#333',
            letterSpacing: '0.04em', textAlign: 'center',
            transition: 'color 0.15s',
          }}>
            {dragOver ? 'Drop to add' : 'Drop a file'}
          </span>
        </div>
      </div>
    </div>
  )
}
