/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['sql.js', 'pdf-parse', 'mammoth', 'xlsx'],
    outputFileTracingIncludes: {
      '/api/**/*': ['./node_modules/sql.js/dist/sql-wasm.wasm'],
    },
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
