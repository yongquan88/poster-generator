import { Readable } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import viteConfig from '../vite.config'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

async function invokeProxy(path: string, baseUrl: string, isEdit = false) {
  const config = await (viteConfig as any)({ command: 'serve', mode: 'test' })
  const plugin = config.plugins.flat().find((item: any) => item.name === 'openai-sdk-proxy')
  const handlers = new Map<string, (req: any, res: any) => Promise<void>>()
  plugin.configureServer({ middlewares: { use: (route: string, fn: any) => handlers.set(route, fn) } })
  let contentType = 'application/json'
  let body = Buffer.from(JSON.stringify({ model: 'gpt-image-2', prompt: 'test' }))
  if (isEdit) {
    const form = new FormData()
    form.set('model', 'gpt-image-2')
    form.set('prompt', 'test')
    form.append('image[]', new Blob(['test'], { type: 'image/png' }), 'test.png')
    const request = new Request('http://localhost/', { method: 'POST', body: form })
    contentType = request.headers.get('content-type')!
    body = Buffer.from(await request.arrayBuffer())
  }
  const req = Object.assign(Readable.from([body]), {
    method: 'POST', url: '/',
    headers: { host: 'localhost', authorization: 'Bearer test-key', 'x-openai-base-url': baseUrl, 'content-type': contentType },
  })
  let payload = ''
  const res = { statusCode: 200, setHeader: vi.fn(), end: (value: string) => { payload = String(value) } }
  await handlers.get(path)!(req, res)
  return { status: res.statusCode, body: JSON.parse(payload) }
}

describe('local OpenAI SDK proxy', () => {
  it.each([
    ['https://api.openai.com', 'https://api.openai.com/v1'],
    ['https://api.openai.com/v1/', 'https://api.openai.com/v1'],
    ['https://api.example.com/gateway', 'https://api.example.com/gateway/v1'],
  ])('uses the same versioned URL as direct requests for %s', async (baseUrl, expectedBase) => {
    let upstreamUrl = ''
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      upstreamUrl = String(url)
      return new Response(JSON.stringify({ data: [{ b64_json: 'aW1hZ2U=' }] }), { headers: { 'Content-Type': 'application/json' } })
    })
    const result = await invokeProxy('/openai-sdk-proxy/images/generations', baseUrl)
    expect(upstreamUrl).toBe(`${expectedBase}/images/generations`)
    expect(result.status).toBe(200)
  })

  it('normalizes the edit URL and omits response_format when absent', async () => {
    let upstreamUrl = ''
    let upstreamBody: unknown
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      upstreamUrl = String(url)
      upstreamBody = init?.body
      return new Response(JSON.stringify({ data: [{ b64_json: 'aW1hZ2U=' }] }), { headers: { 'Content-Type': 'application/json' } })
    })
    const result = await invokeProxy('/openai-sdk-proxy/images/edits', 'https://api.openai.com', true)
    expect(upstreamUrl).toBe('https://api.openai.com/v1/images/edits')
    expect((upstreamBody as FormData).has('response_format')).toBe(false)
    expect(result.status).toBe(200)
  })

  it.each([400, 401, 404, 429])('does not report an HTTP %s as missing network proxy settings', async (status) => {
    for (const name of ['HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY', 'https_proxy', 'http_proxy', 'all_proxy']) vi.stubEnv(name, '')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { message: 'upstream error' } }), { status, headers: { 'Content-Type': 'application/json', 'x-should-retry': 'false' } }))
    const result = await invokeProxy('/openai-sdk-proxy/images/generations', 'https://api.openai.com/v1')
    expect(result.body.error.message).toContain('upstream error')
    expect(result.body.error.message).not.toContain('HTTPS_PROXY')
  })
})
