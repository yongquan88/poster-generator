import { describe, expect, it } from 'vitest'
import { POSTER_SIZE_PRESETS, calculateImageSize, normalizeImageSize } from './size'

function expectOfficialSize(value: string) {
  const match = value.match(/^(\d+)x(\d+)$/)
  expect(match).not.toBeNull()
  const width = Number(match?.[1])
  const height = Number(match?.[2])

  expect(width % 16).toBe(0)
  expect(height % 16).toBe(0)
  expect(width).toBeLessThanOrEqual(3840)
  expect(height).toBeLessThanOrEqual(3840)
  expect(width / height).toBeLessThanOrEqual(3)
  expect(height / width).toBeLessThanOrEqual(3)
}

describe('image size helpers', () => {
  it('keeps official gpt-image-2 standard sizes unchanged', () => {
    expect(normalizeImageSize('1024x1024')).toBe('1024x1024')
    expect(normalizeImageSize('1536x1024')).toBe('1536x1024')
    expect(normalizeImageSize('1024x1536')).toBe('1024x1536')
  })

  it('rounds custom sizes to multiples of 16', () => {
    expect(normalizeImageSize('1151x2047')).toBe('1152x2048')
  })

  it('clamps custom sizes to the model side bounds', () => {
    expectOfficialSize(normalizeImageSize('5000x3000'))
    expectOfficialSize(normalizeImageSize('3000x5000'))
  })

  it('clamps aspect ratios to the official 1:3 to 3:1 range', () => {
    const wide = normalizeImageSize('4096x512')
    const tall = normalizeImageSize('512x4096')

    expectOfficialSize(wide)
    expectOfficialSize(tall)
    expect(wide).toBe('1440x480')
    expect(tall).toBe('480x1440')
  })

  it('keeps 4K ratio presets inside the model bounds', () => {
    expect(calculateImageSize('4K', '16:9')).toBe('3840x2160')
    expect(calculateImageSize('4K', '9:16')).toBe('2160x3840')
    expectOfficialSize(calculateImageSize('4K', '9:16') ?? '')
  })

  it('includes print poster presets sized by long edge', () => {
    expect(POSTER_SIZE_PRESETS.map((preset) => preset.size)).toEqual(['1712x3840', '1440x3840'])
    for (const preset of POSTER_SIZE_PRESETS) {
      expect(normalizeImageSize(preset.size)).toBe(preset.size)
      expectOfficialSize(preset.size)
    }
  })
})
