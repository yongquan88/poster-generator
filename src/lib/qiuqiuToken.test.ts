import { describe, expect, it } from 'vitest'
import { getQiuqiuTokenImageModel, isQiuqiuTokenBaseUrl } from './qiuqiuToken'

describe('getQiuqiuTokenImageModel', () => {
  it('uses the configured model ID', () => {
    expect(getQiuqiuTokenImageModel('custom-image-model')).toBe('custom-image-model')
  })

  it('falls back to gpt-image-2 when the configured model ID is blank', () => {
    expect(getQiuqiuTokenImageModel('   ')).toBe('gpt-image-2')
  })
})

describe('isQiuqiuTokenBaseUrl', () => {
  it('matches any qiuqiutoken.com host', () => {
    expect(isQiuqiuTokenBaseUrl('https://img.qiuqiutoken.com/v1')).toBe(true)
    expect(isQiuqiuTokenBaseUrl('https://api.qiuqiutoken.com/v1')).toBe(true)
    expect(isQiuqiuTokenBaseUrl('https://qiuqiutoken.com/v1')).toBe(true)
  })

  it('matches compatible 1route image API host', () => {
    expect(isQiuqiuTokenBaseUrl('https://image-api.1route.dev/v1')).toBe(true)
    expect(isQiuqiuTokenBaseUrl('https://image-api.1route.dev')).toBe(true)
  })

  it('does not match lookalike domains', () => {
    expect(isQiuqiuTokenBaseUrl('https://qiuqiutoken.com.evil.test/v1')).toBe(false)
    expect(isQiuqiuTokenBaseUrl('https://not-qiuqiutoken.com/v1')).toBe(false)
    expect(isQiuqiuTokenBaseUrl('https://fake-image-api.1route.dev/v1')).toBe(false)
  })
})
