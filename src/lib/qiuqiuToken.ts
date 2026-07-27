export const QIUQIU_TOKEN_BASE_URL = 'https://img.qiuqiutoken.com/v1'
export const QIUQIU_TOKEN_IMAGE_MODEL = 'gpt-image-2'
export const QIUQIU_TOKEN_QMP_OPTIONS = {
  mode: 'async',
  persistence_mode: 'persisted',
} as const
const QIUQIU_TOKEN_COMPATIBLE_HOSTS = new Set(['image-api.1route.dev'])

export function getQiuqiuTokenImageModel(model: string) {
  return model.trim() || QIUQIU_TOKEN_IMAGE_MODEL
}

export function normalizeQiuqiuTokenBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '').toLowerCase()
}

export function isQiuqiuTokenBaseUrl(baseUrl: string) {
  try {
    const hostname = new URL(normalizeQiuqiuTokenBaseUrl(baseUrl)).hostname
    if (QIUQIU_TOKEN_COMPATIBLE_HOSTS.has(hostname)) return true
    return hostname === 'qiuqiutoken.com' || hostname.endsWith('.qiuqiutoken.com')
  } catch {
    return false
  }
}
