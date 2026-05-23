import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: '#070807', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '16px', fontFamily: 'inherit',
    }}>
      <span style={{ fontSize: '11px', color: '#151615', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        404
      </span>
      <p style={{ fontSize: '14px', color: 'rgba(230,226,216,0.45)', margin: 0 }}>
        Nothing here.
      </p>
      <Link href="/" style={{ fontSize: '12px', color: 'rgba(230,226,216,0.45)', letterSpacing: '0.06em', textDecoration: 'none' }}>
        ← Go home
      </Link>
    </div>
  )
}
