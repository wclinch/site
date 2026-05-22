import type { Metadata } from 'next'
import { DM_Mono } from 'next/font/google'
import './globals.css'

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
})

const BASE = 'https://site.app' // TODO: update to production domain before deploying web build

// One canonical description, reused everywhere — keeps OG / Twitter / OG
// image / landing all telling the same story instead of three.
const DESCRIPTION = 'Documents, saved pages, and the live web — held together in a session. Leave and come back to the same setup.'
const TAGLINE     = 'Site — Sessions for focused work.'

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
