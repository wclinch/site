const VISUAL_TRIGGERS = [
  /what.{0,12}(am i|are you) (looking|seeing|viewing)/i,
  /what.{0,20}(on|in).{0,15}(screen|window|here)/i,
  /what.{0,12}(open|visible|showing|displayed)/i,
  /what.{0,10}(current|right now)/i,
  /can you see/i,
  /describe.{0,20}(session|screen|window|view|layout|current)/i,
  /what.{0,12}view [12]/i,
  /what.{0,12}in view/i,
  /look at.{0,15}(this|screen|window|current)/i,
  /\bscreenshot\b/i,
  /\b(this|current).{0,15}(layout|screen|window|view|session)\b/i,
  /what.{0,12}here/i,
  /what should i (do|focus|start|read)/i,
  /what('s| is) wrong/i,
  /what('s| is) open/i,
]

export function needsVisualContext(prompt: string): boolean {
  return VISUAL_TRIGGERS.some(p => p.test(prompt))
}
