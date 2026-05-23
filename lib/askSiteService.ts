import type { AskSiteRequest, AskSiteResponse, AskSiteConfig } from './askSiteTypes'
import { checkAskSiteLimit, incrementAskSiteUsage } from './askSiteRateLimit'
import { callAI, hasAIKey } from './ai/aiClient'
import { buildSystemPrompt } from './ai/sessionContext'

export { buildSystemPrompt } from './ai/sessionContext'

export async function askSiteAI(req: AskSiteRequest, config: AskSiteConfig): Promise<AskSiteResponse> {
  // Plan enforcement: Free users cannot send messages
  const isPro = config.isPro ?? false
  const { allowed, limit } = checkAskSiteLimit(isPro)
  if (!allowed) {
    if (!isPro) {
      return {
        content: 'Ask Site is included with Pro.\nUpgrade to ask the current session.',
        isRateLimited: true,
      }
    }
    return {
      content: `Daily Ask Site limit reached.\nYou've used all ${limit} messages for today. Your limit resets tomorrow.`,
      isRateLimited: true,
    }
  }

  // No provider configured → informative placeholder, no usage counted
  if (!hasAIKey()) {
    return { content: buildNoKeyResponse(), isBeta: true }
  }

  incrementAskSiteUsage()

  const screenshot = req.screenshot ?? undefined
  const res = await callAI({
    system: buildSystemPrompt(req.context, !!screenshot),
    messages: req.messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    imageBase64: screenshot,
  })

  if (res.error === 'no_key') {
    return { content: buildNoKeyResponse(), isBeta: true }
  }

  if (res.error) {
    return {
      content: `Ask Site could not respond.\n${res.error}`,
      error: res.error,
    }
  }

  return { content: res.content }
}

function buildNoKeyResponse(): string {
  return [
    'Ask Site is not connected to an AI provider.',
    '',
    'To enable responses, set NEXT_PUBLIC_AI_API_KEY in your environment.',
    'Get a free Gemini key at aistudio.google.com/app/apikey',
    'Set NEXT_PUBLIC_AI_PROVIDER=gemini and NEXT_PUBLIC_AI_API_KEY=your-key',
  ].join('\n')
}
