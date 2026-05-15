/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'],
    outputFileTracingIncludes: {
      '/api/card': [
        './public/pigeon.png',
        './public/cardbk.jpg',
        './public/fonts/playfair-italic-700.woff2',
        './public/fonts/noto-naskh-arabic.woff2',
      ],
    },
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Prevent the site from being embedded in an iframe (clickjacking)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Stop browsers from MIME-sniffing the content type
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Enforce HTTPS for 1 year (Vercel already uses HTTPS)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Limit referrer info sent to external sites
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Restrict browser features the site doesn't use
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Basic XSS protection for older browsers
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ]
  },
};

export default nextConfig;
