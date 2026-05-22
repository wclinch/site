'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BackButton() {
  const router = useRouter()
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={() => router.back()}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'none', border: 'none', padding: 0,
        fontSize: '12px', color: hov ? '#E6E2D8' : '#8C887F',
        letterSpacing: '0.02em', cursor: 'pointer',
        fontFamily: 'inherit', transition: 'color 0.1s',
      }}
    >
      Close
    </button>
  )
}
