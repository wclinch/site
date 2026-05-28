import type { AskSiteRequest, AskSiteResponse } from './askSiteTypes'
import { checkAskSiteLimit, incrementAskSiteUsage, DAILY_ASK_LIMIT } from './askSiteRateLimit'
import { callAI, hasAIKey } from './ai/aiClient'
import { buildSystemPrompt } from './ai/sessionContext'

export { buildSystemPrompt } from './ai/sessionContext'

export async function askSiteAI(req: AskSiteRequest): Promise<AskSiteResponse> {
  const { allowed, used } = checkAskSiteLimit()
  if (!allowed) {
    return {
      content: `Daily limit reached.\nYou've used all ${DAILY_ASK_LIMIT} messages for today. Resets tomorrow.`,
      isRateLimited: true,
    }
  }

  if (!hasAIKey()) {
    return { content: buildNoKeyResponse(), isBeta: true }
  }

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
      content: 'Ask Site could not respond. Please try again.',
      error: res.error,
    }
  }

  incrementAskSiteUsage()
  return { content: res.content }
}

function buildNoKeyResponse(): string {
  return 'Ask Site is not configured in this build.\nTry again later.'
}
