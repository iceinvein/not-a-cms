export type AskContext = {
  title: string
  text: string
  href?: string
}

export type AskProvider = {
  model: string
  embed(texts: string[]): Promise<number[][]>
  synthesize?(question: string, contexts: AskContext[]): Promise<string>
}

export type AskConfig = {
  provider?: AskProvider
  topK?: number
}
