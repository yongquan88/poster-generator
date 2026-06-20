import type { AppSettings } from '../types'

const USER_PROMPT_SECTION_TITLE = '以下是设计师本次具体需求，请在满足上方系统要求的前提下执行：'

export function applySystemPrompt(settings: AppSettings, userPrompt: string): string {
  if (settings.systemPromptEnabled !== true) return userPrompt

  const systemPrompt = settings.systemPrompt.trim()
  if (!systemPrompt) return userPrompt

  return [
    systemPrompt,
    '',
    USER_PROMPT_SECTION_TITLE,
    userPrompt,
  ].join('\n')
}
