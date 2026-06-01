import type { PromptSnippet } from '../types'

export type PromptSnippetMoveDirection = 'up' | 'down'

export function movePromptSnippet(
  snippets: PromptSnippet[],
  id: string,
  direction: PromptSnippetMoveDirection,
): PromptSnippet[] {
  const index = snippets.findIndex((item) => item.id === id)
  if (index < 0) return snippets

  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= snippets.length) return snippets

  const moved = [...snippets]
  const current = moved[index]
  moved[index] = moved[targetIndex]
  moved[targetIndex] = current
  return moved
}
