import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
// Internal companion service. Explicit public and authenticated live-control routes are proxied.
// Next records rewrites at build time; local/nonstandard deployments set this before building.
const translationProcessor = new URL(process.env.TRANSLATION_PROCESSOR_URL || 'http://translation-processor:4310')
if (!['http:', 'https:'].includes(translationProcessor.protocol) || translationProcessor.username || translationProcessor.password || translationProcessor.pathname !== '/' || translationProcessor.search || translationProcessor.hash) {
  throw new Error('TRANSLATION_PROCESSOR_URL must be an HTTP(S) origin without credentials or a path')
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  output: 'standalone',
  async rewrites() {
    return [
      ...['service', 'events', 'token', 'audio/:sessionId/:clipId.wav'].map(endpoint => ({ source: `/translation/api/public/${endpoint}`, destination: `${translationProcessor.origin}/api/public/${endpoint}` })),
      ...['preflight', 'context-documents', 'sessions', 'sessions/current', 'sessions/current/start', 'sessions/current/stop', 'sessions/current/channels/:channelId', 'operator/events', 'capture/audio'].map(endpoint => ({ source: `/translation/api/${endpoint}`, destination: `${translationProcessor.origin}/api/${endpoint}` })),
      ...['archives', 'archives/:sessionId/audio/:channelId', 'archives/:sessionId/transcripts/:channelId', 'archives/:sessionId/latency'].map(endpoint => ({ source: `/translation/api/${endpoint}`, destination: `${translationProcessor.origin}/api/${endpoint}` })),
      { source: '/translation/client/:file', destination: `${translationProcessor.origin}/client/:file` },
    ]
  },
  images: {
    localPatterns: [{ pathname: '/api/media/file/**' }],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return webpackConfig
  },
  turbopack: { root: path.resolve(dirname) },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
