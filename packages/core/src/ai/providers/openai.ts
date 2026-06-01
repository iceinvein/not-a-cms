import type { AskContext, AskProvider } from "../provider"

type OpenAIAskProviderOptions = {
  apiKey: string
  embeddingModel?: string
  chatModel?: string
  baseUrl?: string
  fetcher?: typeof fetch
}

type OpenAIEmbeddingResponse = {
  data?: Array<{ embedding?: number[] }>
  error?: { message?: string }
}

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

export function createOpenAIAskProvider(options: OpenAIAskProviderOptions): AskProvider {
  const embeddingModel = options.embeddingModel ?? "text-embedding-3-small"
  const baseUrl = options.baseUrl ?? "https://api.openai.com/v1"
  const fetcher = options.fetcher ?? fetch

  async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetcher(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
    const json = await res.json() as T & { error?: { message?: string } }
    if (!res.ok) throw new Error(json.error?.message ?? `OpenAI request failed: ${res.status}`)
    return json
  }

  return {
    model: embeddingModel,
    async embed(texts) {
      const json = await post<OpenAIEmbeddingResponse>("/embeddings", {
        model: embeddingModel,
        input: texts,
      })
      return (json.data ?? []).map((item) => item.embedding ?? [])
    },
    synthesize: options.chatModel
      ? async (question: string, contexts: AskContext[]) => {
          const json = await post<OpenAIChatResponse>("/chat/completions", {
            model: options.chatModel,
            messages: [
              {
                role: "system",
                content: "Answer using only the supplied CMS contexts. If the answer is not present, say you do not know.",
              },
              {
                role: "user",
                content: formatAskPrompt(question, contexts),
              },
            ],
          })
          return json.choices?.[0]?.message?.content?.trim() ?? ""
        }
      : undefined,
  }
}

function formatAskPrompt(question: string, contexts: AskContext[]): string {
  const contextText = contexts.map((ctx, index) => [
    `Context ${index + 1}: ${ctx.title}`,
    ctx.href ? `URL: ${ctx.href}` : "",
    ctx.text,
  ].filter(Boolean).join("\n")).join("\n\n")
  return `Question: ${question}\n\n${contextText}`
}
