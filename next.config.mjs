/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Serve the OpenCV JS wrapper with the correct MIME type
        source: '/opencv/:path*.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Serve the standalone WASM binary (if present) with the correct MIME type
        source: '/opencv/:path*.wasm',
        headers: [
          { key: 'Content-Type', value: 'application/wasm' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default nextConfig
