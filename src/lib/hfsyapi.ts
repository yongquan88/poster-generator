export const HFSYAPI_BASE_URL = 'https://www.hfsyapi.cn/v1'
export const HFSYAPI_IMAGE_MODEL = 'gpt-image-2pro'
export const HFSYAPI_MAX_REFERENCE_IMAGES = 4

export function normalizeHfsyApiBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '').toLowerCase()
}

export function isHfsyApiBaseUrl(baseUrl: string) {
  return normalizeHfsyApiBaseUrl(baseUrl) === HFSYAPI_BASE_URL
}
