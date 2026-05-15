import { MetadataRoute } from 'next'

// Required by `output: 'export'` (desktop build) so a static `sitemap.xml`
// is emitted; web build is unaffected.
export const dynamic = 'force-static'

const BASE = 'https://site.app' // TODO: update to production domain

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE,            lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
    { url: `${BASE}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ]
}
