import { describe, expect, it } from 'vitest'
import { isQiuqiuTokenBaseUrl } from './qiuqiuToken'

describe('isQiuqiuTokenBaseUrl', () => {
  it('matches any qiuqiutoken.com host', () => {
    expect(isQiuqiuTokenBaseUrl('https://img.qiuqiutoken.com/v1')).toBe(true)
    expect(isQiuqiuTokenBaseUrl('https://api.qiuqiutoken.com/v1')).toBe(true)
    expect(isQiuqiuTokenBaseUrl('https://qiuqiutoken.com/v1')).toBe(true)
  })

  it('does not match lookalike domains', () => {
    expect(isQiuqiuTokenBaseUrl('https://qiuqiutoken.com.evil.test/v1')).toBe(false)
    expect(isQiuqiuTokenBaseUrl('https://not-qiuqiutoken.com/v1')).toBe(false)
  })
})
