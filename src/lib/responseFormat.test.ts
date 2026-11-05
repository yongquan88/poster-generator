import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PARAMS } from '../types'
import { callImageApi } from './api'
import { createDefaultOpenAIProfile, normalizeSettings, switchApiProfileProvider } from './apiProfiles'
import { buildSettingsFromUrlParams } from './urlSettings'

function mockImagesApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
    String(url).startsWith('data:')
      ? new Response(new Uint8Array([1]), { headers: { 'Content-Type': 'image/png' } })
      : new Response(JSON.stringify({ data: [{ b64_json: 'aW1hZ2U=' }] }), {
          headers: { 'Content-Type': 'application/json' },
        }),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('response_format request switch', () => {
  for (const isEdit of [false, true]) {
    for (const useLocalSdkProxy of [false, true]) {
      it.each([false, true])(`omits the parameter when disabled (edit=${isEdit}, SDK proxy=${useLocalSdkProxy}, Base64=%s)`, async (responseFormatB64Json) => {
        if (useLocalSdkProxy) {
          vi.stubEnv('DEV', true)
          vi.stubEnv('VITEST', '')
        }
        const fetchMock = mockImagesApi()
        const profile = createDefaultOpenAIProfile({
          baseUrl: 'https://api.openai.com/v1', apiKey: 'test-key',
          sendResponseFormat: false, responseFormatB64Json,
        })
        const result = await callImageApi({
          settings: normalizeSettings({ profiles: [profile] }),
          prompt: 'test', params: { ...DEFAULT_PARAMS },
          inputImageDataUrls: isEdit ? ['data:image/png;base64,aW1hZ2U='] : [],
        })
        const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith(isEdit ? '/images/edits' : '/images/generations'))!
        expect(call).toBeTruthy()
        const body = call[1]?.body
        if (isEdit) expect((body as FormData).has('response_format')).toBe(false)
        else expect(JSON.parse(String(body))).not.toHaveProperty('response_format')
        expect(result.images).toEqual(['data:image/png;base64,aW1hZ2U='])
      })
    }
    it.each([false, true])(`preserves the selected format when explicitly enabled (edit=${isEdit}, Base64=%s)`, async (responseFormatB64Json) => {
      const fetchMock = mockImagesApi()
      const profile = createDefaultOpenAIProfile({
        baseUrl: 'https://api.openai.com/v1', apiKey: 'test-key',
        sendResponseFormat: true, responseFormatB64Json,
      })
      await callImageApi({
        settings: normalizeSettings({ profiles: [profile] }),
        prompt: 'test', params: { ...DEFAULT_PARAMS },
        inputImageDataUrls: isEdit ? ['data:image/png;base64,aW1hZ2U='] : [],
      })
      const call = fetchMock.mock.calls.find(([url]) => String(url).startsWith('https://api.openai.com/'))!
      const body = call[1]?.body
      expect(isEdit ? (body as FormData).get('response_format') : JSON.parse(String(body)).response_format)
        .toBe(responseFormatB64Json ? 'b64_json' : 'url')
    })
  }

  it('omits the fixed format for hfsyapi when disabled', async () => {
    const fetchMock = mockImagesApi()
    const profile = createDefaultOpenAIProfile({ baseUrl: 'https://www.hfsyapi.cn/v1', apiKey: 'test-key', sendResponseFormat: false })
    await callImageApi({ settings: normalizeSettings({ profiles: [profile] }), prompt: 'test', params: { ...DEFAULT_PARAMS }, inputImageDataUrls: [] })
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).not.toHaveProperty('response_format')
  })

  it.each(['json', 'multipart'] as const)('omits custom template and injected format when disabled (%s)', async (contentType) => {
    const fetchMock = mockImagesApi()
    const profile = createDefaultOpenAIProfile({ provider: 'custom-test', baseUrl: 'https://custom.example.com/v1', apiKey: 'test-key', sendResponseFormat: false, responseFormatB64Json: true })
    await callImageApi({
      settings: normalizeSettings({ profiles: [profile], customProviders: [{
        id: 'custom-test', name: 'Test', template: 'http-image',
        submit: { path: 'images/generations', method: 'POST', contentType, body: { prompt: '$prompt', response_format: 'url' }, result: { b64JsonPaths: ['data.*.b64_json'] } },
      }] }),
      prompt: 'test', params: { ...DEFAULT_PARAMS }, inputImageDataUrls: [],
    })
    const body = fetchMock.mock.calls[0][1]?.body
    if (contentType === 'multipart') expect((body as FormData).has('response_format')).toBe(false)
    else expect(JSON.parse(String(body))).not.toHaveProperty('response_format')
  })
})

describe('response_format setting persistence', () => {
  it('keeps disabled state and Base64 choice after saving and switching providers', () => {
    const profile = createDefaultOpenAIProfile({ sendResponseFormat: false, responseFormatB64Json: true })
    const fal = switchApiProfileProvider(profile, 'fal')
    const saved = normalizeSettings(JSON.parse(JSON.stringify({ profiles: [fal] })))
    const restored = switchApiProfileProvider(saved.profiles[0], 'openai')
    expect(restored.sendResponseFormat).toBe(false)
    expect(restored.responseFormatB64Json).toBe(true)
  })

  it('preserves the disabled setting when importing a settings URL', () => {
    const profile = createDefaultOpenAIProfile({ id: 'imported', baseUrl: 'https://api.openai.com/v1', sendResponseFormat: false })
    const params = new URLSearchParams({ settings: JSON.stringify({ profiles: [profile] }) })
    const settings = normalizeSettings(buildSettingsFromUrlParams({}, params))
    expect(settings.profiles.find(p => p.id === settings.activeProfileId)?.sendResponseFormat).toBe(false)
  })

  it('imports the switch from a short URL without reusing a profile with the opposite setting', () => {
    const existing = createDefaultOpenAIProfile({ id: 'existing', baseUrl: 'https://api.openai.com/v1', apiKey: 'test-key' })
    const current = normalizeSettings({ profiles: [existing] })
    const params = new URLSearchParams({ apiUrl: existing.baseUrl, apiKey: 'test-key', model: existing.model, sendResponseFormat: 'false' })
    const settings = normalizeSettings(buildSettingsFromUrlParams(current, params))
    expect(settings.profiles).toHaveLength(2)
    expect(settings.profiles.find(p => p.id === settings.activeProfileId)?.sendResponseFormat).toBe(false)
  })
})
