/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/opencv/:path*.js',
        headers: [
          { key: 'Content-Type',  value: 'application/javascript' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/opencv/:path*.wasm',
        headers: [
          { key: 'Content-Type',  value: 'application/wasm' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default nextConfig
