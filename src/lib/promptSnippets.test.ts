import { describe, expect, it } from 'vitest'
import type { PromptSnippet } from '../types'
import { movePromptSnippet } from './promptSnippets'

const snippets: PromptSnippet[] = [
  { id: 'a', title: 'A', content: 'first' },
  { id: 'b', title: 'B', content: 'second' },
  { id: 'c', title: 'C', content: 'third' },
]

describe('movePromptSnippet', () => {
  it('moves a prompt snippet up without mutating the original list', () => {
    const moved = movePromptSnippet(snippets, 'b', 'up')

    expect(moved.map((item) => item.id)).toEqual(['b', 'a', 'c'])
    expect(snippets.map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })

  it('moves a prompt snippet down', () => {
    const moved = movePromptSnippet(snippets, 'b', 'down')

    expect(moved.map((item) => item.id)).toEqual(['a', 'c', 'b'])
  })

  it('keeps the order unchanged when moving beyond list boundaries', () => {
    expect(movePromptSnippet(snippets, 'a', 'up')).toEqual(snippets)
    expect(movePromptSnippet(snippets, 'c', 'down')).toEqual(snippets)
    expect(movePromptSnippet(snippets, 'missing', 'up')).toEqual(snippets)
  })
})
