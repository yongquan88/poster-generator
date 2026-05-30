import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchImageUrlAsDataUrl } from './imageApiShared'

describe('fetchImageUrlAsDataUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('upgrades Aliyun OSS http image URLs to https before fetching', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Blob(['image'], { type: 'image/png' }), {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    }))

    await fetchImageUrlAsDataUrl(
      'http://sd2oss-american.oss-us-west-1.aliyuncs.com/2026-05-30%2Fimage.png?Signature=test',
      'image/png',
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'https://sd2oss-american.oss-us-west-1.aliyuncs.com/2026-05-30%2Fimage.png?Signature=test',
      expect.objectContaining({ cache: 'no-store' }),
    )
  })
})
