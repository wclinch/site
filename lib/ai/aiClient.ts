import type { AICallRequest, AICallResponse, AIProviderName } from './types'
import { callAnthropic } from './providers/anthropic'
import { callGemini } from './providers/gemini'

interface ResolvedConfig {
  provider: AIProviderName
  apiKey: string
  model: string | undefined
}

function resolveConfig(): ResolvedConfig {
  const provider = (process.env.NEXT_PUBLIC_AI_PROVIDER ?? 'gemini') as AIProviderName

  const apiKey =
    (typeof window !== 'undefined'
      ? (localStorage.getItem('site-ask-api-key') ?? null)
      : null) ??
    process.env.NEXT_PUBLIC_AI_API_KEY ??
    process.env.NEXT_PUBLIC_SITE_AI_KEY ??  // legacy compat
    ''

  const model = process.env.NEXT_PUBLIC_AI_MODEL || undefined

  return { provider, apiKey, model }
}

export function hasAIKey(): boolean {
  return !!resolveConfig().apiKey
}

export async function callAI(req: AICallRequest): Promise<AICallResponse> {
  const { provider, apiKey, model } = resolveConfig()

  if (!apiKey) return { content: '', error: 'no_key' }

  switch (provider) {
    case 'anthropic':
      return callAnthropic(req, apiKey, model)
    case 'gemini':
      return callGemini(req, apiKey, model)
    default:
      return { content: '', error: `Unknown provider "${provider}". Set NEXT_PUBLIC_AI_PROVIDER to "gemini" or "anthropic".` }
  }
}
