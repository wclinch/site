import type { Metadata } from 'next'
import { DM_Mono } from 'next/font/google'
import './globals.css'

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
})

const BASE = 'https://proof-kxfz.onrender.com'

// One canonical description, reused everywhere — keeps OG / Twitter / OG
// image / landing all telling the same story instead of three.
const DESCRIPTION = 'A local-first, source-native workspace for reading and writing. PDFs, images, and web pages alongside the draft. One window, on the device. No account. No cloud.'
const TAGLINE     = 'Site — Structured for thought.'

export const metadata: Metadata = {
  title: {
    default: 'Site',
    template: '%s — Site',
  },
  description: DESCRIPTION,
  metadataBase: new URL(BASE),
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    siteName: 'Site',
    title: TAGLINE,
    description: DESCRIPTION,
    url: BASE,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TAGLINE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmMono.className}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
