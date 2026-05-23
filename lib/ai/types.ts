export interface AIChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AICallRequest {
  system: string
  messages: AIChatMessage[]
  maxTokens?: number
  imageBase64?: string
  imageMimeType?: 'image/png' | 'image/jpeg'
}

export interface AICallResponse {
  content: string
  error?: string
}

export type AIProviderName = 'anthropic' | 'openai' | 'openrouter' | 'gemini' | 'groq'
