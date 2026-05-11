import type { NextConfig } from "next";

// When NEXT_BUILD_TARGET=desktop we produce a static export under `out/` that
// the Electron main process serves via a custom `site://` protocol. The
// regular web build (npm run build) is unaffected and continues to ship the
// marketing pages at `/`, `/about`, `/privacy`.
const isDesktop = process.env.NEXT_BUILD_TARGET === 'desktop'

const nextConfig: NextConfig = {
  devIndicators: false,
  // pdfjs-dist requires canvas in its Node.js code path; mark it external
  // so Next.js doesn't try to bundle it (extraction only runs client-side)
  serverExternalPackages: ['pdfjs-dist', 'canvas'],
  ...(isDesktop ? {
    output: 'export' as const,
    trailingSlash: true,
    images: { unoptimized: true },
  } : {}),
  turbopack: {
    resolveAlias: {
      canvas: './lib/canvas-stub.js',
    },
  },
};

export default nextConfig;
