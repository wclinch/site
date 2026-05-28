const KEY = 'ask-site-daily-usage'

export const DAILY_ASK_LIMIT = 10

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function getAskSiteUsageToday(): number {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return 0
    const { date, count } = JSON.parse(raw) as { date: string; count: number }
    return date === todayKey() ? (count ?? 0) : 0
  } catch { return 0 }
}

export function incrementAskSiteUsage(): void {
  try {
    const count = getAskSiteUsageToday()
    localStorage.setItem(KEY, JSON.stringify({ date: todayKey(), count: count + 1 }))
  } catch {}
}

export function checkAskSiteLimit(): { allowed: boolean; used: number; limit: number } {
  const used = getAskSiteUsageToday()
  return { allowed: used < DAILY_ASK_LIMIT, used, limit: DAILY_ASK_LIMIT }
}
