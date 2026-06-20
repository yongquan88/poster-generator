import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from './apiProfiles'
import { applySystemPrompt } from './systemPrompt'

describe('applySystemPrompt', () => {
  it('returns the user prompt when the system prompt is disabled', () => {
    expect(applySystemPrompt({
      ...DEFAULT_SETTINGS,
      systemPromptEnabled: false,
      systemPrompt: 'system prompt',
    }, 'user prompt')).toBe('user prompt')
  })

  it('returns the user prompt when the system prompt is empty', () => {
    expect(applySystemPrompt({
      ...DEFAULT_SETTINGS,
      systemPromptEnabled: true,
      systemPrompt: '   ',
    }, 'user prompt')).toBe('user prompt')
  })

  it('prefixes the user prompt with the enabled system prompt', () => {
    expect(applySystemPrompt({
      ...DEFAULT_SETTINGS,
      systemPromptEnabled: true,
      systemPrompt: 'system prompt',
    }, 'user prompt')).toBe([
      'system prompt',
      '',
      '以下是设计师本次具体需求，请在满足上方系统要求的前提下执行：',
      'user prompt',
    ].join('\n'))
  })
})
