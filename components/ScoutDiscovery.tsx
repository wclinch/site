'use client'
import { useState, useRef, useEffect } from 'react'
import { useApp } from '@/context/AppContext'

export default function ScoutDiscovery({ onClose }: { onClose: () => void }) {
  const { addUrl } = useApp()
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<Array<{ title: string; url: string; description: string }>>([])
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)

    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }

    setLoading(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setResults(data.results || [])
      } catch (err) {
        console.error('Search error:', err)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [query])

  function addSource(url: string) {
    addUrl(url)
  }

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true) } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false) }}
    >
      {/* Header */}
      <div style={{
        height: '28px', flexShrink: 0, display: 'flex', alignItems: 'center',
        padding: '0 8px 0 14px', borderBottom: '1px solid #1a1a1a',
        background: dragOver ? '#0d0d0d' : 'transparent', transition: 'background 0.15s',
      }}>
        <span style={{ flex: 1, fontSize: '10px', color: '#666', letterSpacing: '0.08em', userSelect: 'none' }}>
          Discovery
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', padding: '4px 8px', cursor: 'pointer',
            fontSize: '15px', color: '#555', lineHeight: 1, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#aaa')}
          onMouseLeave={e => (e.currentTarget.style.color = '#555')}
        >×</button>
      </div>

      {/* Search input */}
      <div style={{ padding: '12px 14px 6px', flexShrink: 0 }}>
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search the web..."
          style={{
            width: '100%', background: '#0d0d0d', border: '1px solid #1a1a1a',
            borderRadius: '4px', padding: '9px 14px', outline: 'none', boxSizing: 'border-box',
            fontSize: '12px', color: '#bbb', fontFamily: 'inherit', letterSpacing: '0.02em',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = '#333')}
          onBlur={e => (e.currentTarget.style.borderColor = '#1a1a1a')}
        />
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 4px 0' }}>
        {loading ? (
          <div style={{ padding: '14px 10px', fontSize: '11px', color: '#555', letterSpacing: '0.03em' }}>
            Searching...
          </div>
        ) : results.length === 0 ? (
          <div style={{ padding: '14px 10px', fontSize: '11px', color: '#444', letterSpacing: '0.03em' }}>
            {query.trim().length < 2 ? 'Start typing to search.' : 'No results found.'}
          </div>
        ) : results.map((result, i) => (
          <SDResult key={i} title={result.title} url={result.url} description={result.description} onClick={() => addSource(result.url)} />
        ))}
      </div>

    </div>
  )
}

function SDResult({ title, url, description, onClick }: { title: string; url: string; description: string; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', flexDirection: 'column', gap: '4px',
        padding: '9px 10px', cursor: 'pointer', borderRadius: '3px',
        background: hov ? '#0d0d0d' : 'transparent', transition: 'background 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <span style={{
          flex: 1, fontSize: '12px', color: hov ? '#ccc' : '#bbb',
          lineHeight: 1.3, transition: 'color 0.1s',
        }}>{title}</span>
        <span style={{ fontSize: '11px', color: '#555', flexShrink: 0, opacity: hov ? 1 : 0, transition: 'opacity 0.1s' }}>+</span>
      </div>
      <span style={{ fontSize: '10px', color: '#555', lineHeight: 1.2 }}>{url}</span>
      {description && (
        <span style={{ fontSize: '11px', color: '#666', lineHeight: 1.3, marginTop: '2px' }}>{description}</span>
      )}
    </div>
  )
}

function SDBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        fontSize: '11px', color: hov ? '#777' : '#444',
        letterSpacing: '0.04em', fontFamily: 'inherit', transition: 'color 0.15s',
      }}
    >{children}</button>
  )
}
