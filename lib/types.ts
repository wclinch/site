export interface Sentence {
  i: number
  text: string
  // 1-indexed PDF page this sentence came from; undefined on pre-v2 stored data
  page?: number
}

export interface Block {
  sentences: Sentence[]
}

export interface DocContent {
  blocks: Block[]
  // Sentence index (sentence.i) where each PDF page starts (0-indexed pages).
  // pageBreaks[0] = 0 (page 1 starts at sentence 0), pageBreaks[1] = first sentence of page 2, etc.
  pageBreaks: number[]
}

export interface Clip {
  id: string
  sentenceIds: number[]
  centreIdx: number
  editedText?: string    // user-edited override; if set, shown instead of resolved text
  createdAt: number
}

export interface Fragment {
  id: string
  type: 'extract' | 'note' | 'section'
  text: string
  prose?: string
  pageLabel?: string
  sourceLabel?: string
  sourceType?: 'pdf' | 'url' | 'article'
  createdAt: number
}

export interface QueuedSource {
  id: string
  raw: string
  status: 'queued' | 'extracting' | 'done' | 'error'
  error: string | null
  label?: string
  color?: string
  fileType?: 'pdf' | 'image' | 'note' | 'url'
  content?: DocContent
  noteContent?: string
  url?: string
  clips: Clip[]
  draft?: string
}

export interface SavedResearchTab {
  url: string
  title: string
}

export interface Project {
  id: string
  name: string
  sources: QueuedSource[]
  draft: string       // legacy — migrated to fragments on first load
  draftTitle: string  // legacy
  fragments: Fragment[]
  scratchpad?: string
  projectDraft?: string
  // Per-workspace state — saved on switch/explicit save
  sel1?: string | null
  sel2?: string | null
  researchTabs?: SavedResearchTab[]
}
