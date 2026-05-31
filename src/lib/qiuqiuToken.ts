export const QIUQIU_TOKEN_BASE_URL = 'https://img.qiuqiutoken.com/v1'
export const QIUQIU_TOKEN_IMAGE_MODEL = 'gpt-image-2'
export const QIUQIU_TOKEN_QMP_OPTIONS = {
  mode: 'async',
  persistence_mode: 'persisted',
} as const

export function normalizeQiuqiuTokenBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '').toLowerCase()
}

export function isQiuqiuTokenBaseUrl(baseUrl: string) {
  return normalizeQiuqiuTokenBaseUrl(baseUrl) === QIUQIU_TOKEN_BASE_URL
}
