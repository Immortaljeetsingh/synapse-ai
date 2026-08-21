/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  experimental: {
    serverComponentsExternalPackages: ['sql.js', 'pdf-parse', 'mammoth', 'xlsx'],
    outputFileTracingIncludes: {
      '/api/**/*': ['./node_modules/sql.js/dist/sql-wasm.wasm'],
    },
  },
  webpack: (config, { isServer }) => {
    // Stub node builtins for the CLIENT bundle only. Applying `fs: false` to
    // the server build too would break any bundled server code that touches
    // the filesystem (API routes rely on fs/path/crypto).
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
