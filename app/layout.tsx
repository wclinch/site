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
const DESCRIPTION = 'A local-first research workspace. Load PDFs, images, and web pages on the left. Write your draft on the right. Everything in one window — no account, no cloud sync.'
const TAGLINE     = 'Site — Read sources. Write beside them.'

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
