import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import type { IncomingMessage } from 'http'
import type { Plugin, ViteDevServer } from 'vite'
import OpenAI from 'openai'
import { normalizeDevProxyConfig } from './src/lib/devProxy'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

function loadDevProxyConfig() {
  try {
    return normalizeDevProxyConfig(
      JSON.parse(readFileSync('./dev-proxy.config.json', 'utf-8')) as unknown,
    )
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === 'ENOENT') return null
    throw error
  }
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function createOpenAiSdkProxyPlugin(): Plugin {
  return {
    name: 'openai-sdk-proxy',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/openai-sdk-proxy/images/generations', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: { message: 'Method not allowed' } }))
          return
        }

        try {
          const authorization = req.headers.authorization ?? ''
          const apiKey = Array.isArray(authorization)
            ? authorization[0]?.replace(/^Bearer\s+/i, '')
            : authorization.replace(/^Bearer\s+/i, '')
          const baseURLHeader = req.headers['x-openai-base-url']
          const baseURL = Array.isArray(baseURLHeader) ? baseURLHeader[0] : baseURLHeader

          if (!apiKey) throw new Error('Missing Authorization bearer token')
          if (!baseURL) throw new Error('Missing x-openai-base-url header')

          const payload = JSON.parse(await readRequestBody(req))
          const client = new OpenAI({ apiKey, baseURL })
          const result = await client.images.generate({
            model: payload.model,
            prompt: payload.prompt,
            size: payload.size,
            quality: payload.quality,
            output_format: payload.output_format,
            n: payload.n,
            response_format: payload.response_format,
          })

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(result))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({
            error: {
              message: error instanceof Error ? error.message : String(error),
            },
          }))
        }
      })
    },
  }
}

export default defineConfig(({ command }) => {
  const devProxyConfig = command === 'serve' ? loadDevProxyConfig() : null

  return {
    plugins: [react(), createOpenAiSdkProxyPlugin()],
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __DEV_PROXY_CONFIG__: JSON.stringify(devProxyConfig),
    },
    server: {
      host: true,
      proxy:
        devProxyConfig?.enabled
          ? {
              [devProxyConfig.prefix]: {
                target: devProxyConfig.target,
                changeOrigin: devProxyConfig.changeOrigin,
                secure: devProxyConfig.secure,
                rewrite: (path) =>
                  path.replace(
                    new RegExp(`^${devProxyConfig.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
                    '',
                  ),
              },
            }
          : undefined,
    },
  }
})
