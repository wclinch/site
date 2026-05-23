import type { AICallRequest, AICallResponse } from '../types'

// Default model. If you get a "model not found" error, call ListModels:
// GET https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY
const DEFAULT_MODEL = 'gemini-2.5-flash'

export async function callGemini(
  req: AICallRequest,
  apiKey: string,
  model?: string,
): Promise<AICallResponse> {
  const m = model ?? DEFAULT_MODEL
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`

  // Gemini uses "model" for assistant role.
  // Image attaches to the last user message as inline_data.
  const lastUserIdx = [...req.messages].map(m => m.role).lastIndexOf('user')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents = req.messages.map((msg, i): any => {
    const parts: object[] = [{ text: msg.content }]
    if (i === lastUserIdx && req.imageBase64) {
      parts.push({
        inline_data: {
          mime_type: req.imageMimeType ?? 'image/png',
          data: req.imageBase64,
        },
      })
    }
    return { role: msg.role === 'assistant' ? 'model' : 'user', parts }
  })

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: req.system ? { parts: [{ text: req.system }] } : undefined,
        contents,
        generationConfig: { maxOutputTokens: req.maxTokens ?? 2048 },
      }),
    })

    if (!res.ok) {
      if (res.status === 429) return { content: '', error: 'Rate limit reached. Try again in a moment.' }
      if (res.status === 400 || res.status === 403) return { content: '', error: 'Invalid API key.' }
      const body = await res.json().catch(() => ({}))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { content: '', error: (body as any)?.error?.message || `Request failed (${res.status}).` }
    }

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    return { content: text }
  } catch {
    return { content: '', error: 'Network unavailable.' }
  }
}
