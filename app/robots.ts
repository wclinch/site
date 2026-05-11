import { MetadataRoute } from 'next'

// Required by `output: 'export'` (desktop build) — otherwise Next refuses
// to emit a static `robots.txt`. The web build is unaffected.
export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/'],
      },
    ],
    sitemap: 'https://proof-kxfz.onrender.com/sitemap.xml',
  }
}
