/** @type {import('next').NextConfig} */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

// Base path for the policyengine.org multi-zone mount. Set
// NEXT_PUBLIC_BASE_PATH="" for plain local development. lib/site.ts repeats
// this rule for runtime code (this file cannot import TypeScript).
const basePath =
  process.env.NEXT_PUBLIC_BASE_PATH !== undefined
    ? process.env.NEXT_PUBLIC_BASE_PATH
    : '/us/futa-wage-base-dashboard';

const nextConfig = {
  ...(basePath ? { basePath } : {}),
  // Trace files from this directory so the parent repo's files are not scanned.
  outputFileTracingRoot: path.join(__dirname),
  compress: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
