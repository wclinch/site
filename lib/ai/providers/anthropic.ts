import type { AICallRequest, AICallResponse } from '../types'

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

export async function callAnthropic(
  req: AICallRequest,
  apiKey: string,
  model?: string,
): Promise<AICallResponse> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model ?? DEFAULT_MODEL,
        max_tokens: req.maxTokens ?? 1024,
        system: req.system,
        messages: req.messages,
      }),
    })

    if (!res.ok) {
      if (res.status === 429) return { content: '', error: 'Rate limit reached. Try again in a moment.' }
      if (res.status === 401) return { content: '', error: 'Invalid API key.' }
      const body = await res.json().catch(() => ({}))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { content: '', error: (body as any)?.error?.message || `Request failed (${res.status}).` }
    }

    const data = await res.json()
    return { content: data?.content?.[0]?.text ?? '' }
  } catch {
    return { content: '', error: 'Network unavailable.' }
  }
}
