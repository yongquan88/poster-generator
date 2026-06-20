import { getActiveApiProfile, getCustomProviderDefinition } from './apiProfiles'
import { callFalAiImageApi } from './falAiImageApi'
import { callOpenAICompatibleImageApi } from './openaiCompatibleImageApi'
import type { CallApiOptions, CallApiResult } from './imageApiShared'
import { applySystemPrompt } from './systemPrompt'

export type { CallApiOptions, CallApiResult } from './imageApiShared'
export { normalizeBaseUrl } from './devProxy'

export async function callImageApi(opts: CallApiOptions): Promise<CallApiResult> {
  const profile = getActiveApiProfile(opts.settings)
  const enhancedOpts = {
    ...opts,
    prompt: applySystemPrompt(opts.settings, opts.prompt),
  }

  if (profile.provider === 'fal') return callFalAiImageApi(enhancedOpts, profile)

  return callOpenAICompatibleImageApi(enhancedOpts, profile, getCustomProviderDefinition(opts.settings, profile.provider))
}
