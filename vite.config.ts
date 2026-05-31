import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import type { IncomingMessage, ServerResponse } from 'http'
import type { Plugin, ViteDevServer } from 'vite'
import OpenAI, { toFile, type Uploadable } from 'openai'
import { EnvHttpProxyAgent } from 'undici'
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

function readRequestBuffer(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  return (await readRequestBuffer(req)).toString('utf8')
}

function readAuthHeaders(req: IncomingMessage) {
  const authorization = req.headers.authorization ?? ''
  const apiKey = Array.isArray(authorization)
    ? authorization[0]?.replace(/^Bearer\s+/i, '')
    : authorization.replace(/^Bearer\s+/i, '')
  const baseURLHeader = req.headers['x-openai-base-url']
  const baseURL = Array.isArray(baseURLHeader) ? baseURLHeader[0] : baseURLHeader

  if (!apiKey) throw new Error('Missing Authorization bearer token')
  if (!baseURL) throw new Error('Missing x-openai-base-url header')

  return { apiKey, baseURL }
}

function getHeaderValue(req: IncomingMessage, name: string) {
  const value = req.headers[name.toLowerCase()]
  return Array.isArray(value) ? value.join(', ') : value
}

function createRequestFromIncomingMessage(req: IncomingMessage) {
  const method = req.method ?? 'GET'
  const protocol = getHeaderValue(req, 'x-forwarded-proto') ?? 'http'
  const host = getHeaderValue(req, 'host') ?? 'localhost'
  const headers = new Headers()

  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item)
    } else {
      headers.set(key, value)
    }
  }

  return new Request(`${protocol}://${host}${req.url ?? '/'}`, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : req as unknown as BodyInit,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' })
}

function getOptionalString(formData: FormData, field: string) {
  const value = formData.get(field)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function getOptionalNumber(formData: FormData, field: string) {
  const value = getOptionalString(formData, field)
  if (!value) return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

async function formFileToUploadable(value: FormDataEntryValue, fallbackName: string): Promise<Uploadable | null> {
  if (typeof value === 'string') return null
  return toFile(value, value.name || fallbackName, { type: value.type || 'application/octet-stream' })
}

function buildOpenAiProxyTargetUrl(baseURL: string, path: string) {
  return `${baseURL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

function hasEnvProxy() {
  return Boolean(
    process.env.HTTPS_PROXY ||
      process.env.HTTP_PROXY ||
      process.env.ALL_PROXY ||
      process.env.https_proxy ||
      process.env.http_proxy ||
      process.env.all_proxy,
  )
}

async function proxyOpenAiCompatibleRawRequest(req: IncomingMessage, res: ServerResponse, path: string) {
  const { apiKey, baseURL } = readAuthHeaders(req)
  const method = req.method ?? 'GET'
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  }
  const contentType = getHeaderValue(req, 'content-type')
  if (contentType) headers['Content-Type'] = contentType
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readRequestBuffer(req)

  const upstream = await fetch(buildOpenAiProxyTargetUrl(baseURL, path), {
    method,
    headers,
    body,
    cache: 'no-store',
    ...(hasEnvProxy() ? { dispatcher: new EnvHttpProxyAgent() } : {}),
  } as RequestInit & { dispatcher?: EnvHttpProxyAgent })

  res.statusCode = upstream.status
  upstream.headers.forEach((value, key) => {
    if (!['content-encoding', 'content-length'].includes(key.toLowerCase())) res.setHeader(key, value)
  })
  res.end(Buffer.from(await upstream.arrayBuffer()))
}

function shouldUseRawQiuqiuTokenProxy(req: IncomingMessage) {
  return getHeaderValue(req, 'x-qiuqiu-token-async') === 'true'
}

function getProxyErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return String(error)
  const cause = 'cause' in error ? (error as { cause?: unknown }).cause : undefined
  const causeMessage = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : ''
  const message = causeMessage ? `${error.message}: ${causeMessage}` : error.message
  return hasEnvProxy()
    ? message
    : `${message}。本地 Node 代理未检测到 HTTPS_PROXY/HTTP_PROXY/ALL_PROXY；如果浏览器通过代理访问外网，请用例如 HTTPS_PROXY=http://127.0.0.1:7890 npm run dev 启动。`
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
          if (shouldUseRawQiuqiuTokenProxy(req)) {
            await proxyOpenAiCompatibleRawRequest(req, res, 'images/generations')
            return
          }

          const { apiKey, baseURL } = readAuthHeaders(req)
          const payload = JSON.parse(await readRequestBody(req))
          const client = new OpenAI({ apiKey, baseURL })
          const result = await client.images.generate({
            model: payload.model,
            prompt: payload.prompt,
            size: payload.size,
            quality: payload.quality,
            output_format: payload.output_format,
            output_compression: payload.output_compression,
            moderation: payload.moderation,
            n: payload.n,
            response_format: payload.response_format,
            reference_images: payload.reference_images,
          } as any)

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(result))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({
            error: {
              message: getProxyErrorMessage(error),
            },
          }))
        }
      })

      server.middlewares.use('/openai-sdk-proxy/images/edits', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: { message: 'Method not allowed' } }))
          return
        }

        try {
          if (shouldUseRawQiuqiuTokenProxy(req)) {
            await proxyOpenAiCompatibleRawRequest(req, res, 'images/edits')
            return
          }

          const { apiKey, baseURL } = readAuthHeaders(req)
          const formData = await createRequestFromIncomingMessage(req).formData()
          const imageEntries = [
            ...formData.getAll('image[]'),
            ...formData.getAll('image'),
          ]
          const images = (await Promise.all(
            imageEntries.map((entry, index) => formFileToUploadable(entry, `input-${index + 1}.png`)),
          )).filter((entry): entry is Uploadable => Boolean(entry))
          const mask = await formFileToUploadable(formData.get('mask') ?? '', 'mask.png')

          if (!images.length) throw new Error('Missing image files')

          const client = new OpenAI({ apiKey, baseURL })
          const result = await client.images.edit({
            model: getOptionalString(formData, 'model'),
            prompt: getOptionalString(formData, 'prompt') ?? '',
            image: images.length === 1 ? images[0] : images,
            ...(mask ? { mask } : {}),
            size: getOptionalString(formData, 'size'),
            quality: getOptionalString(formData, 'quality') as any,
            output_format: getOptionalString(formData, 'output_format') as any,
            output_compression: getOptionalNumber(formData, 'output_compression'),
            moderation: getOptionalString(formData, 'moderation') as any,
            n: getOptionalNumber(formData, 'n'),
            response_format: getOptionalString(formData, 'response_format') as any,
          } as any)

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(result))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({
            error: {
              message: getProxyErrorMessage(error),
            },
          }))
        }
      })

      server.middlewares.use('/openai-sdk-proxy/images/tasks', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: { message: 'Method not allowed' } }))
          return
        }

        try {
          await proxyOpenAiCompatibleRawRequest(req, res, `images/tasks${req.url ?? ''}`)
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({
            error: {
              message: getProxyErrorMessage(error),
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
