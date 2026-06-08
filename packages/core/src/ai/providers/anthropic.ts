import type { AskContext, AskProvider } from "../provider"

type AnthropicAskProviderOptions = {
  apiKey: string
  model: string
  embed: AskProvider["embed"]
  embeddingModel: string
  baseUrl?: string
  fetcher?: typeof fetch
}

type AnthropicMessagesResponse = {
  content?: Array<{ type: string; text?: string }>
  error?: { message?: string }
}

export function createAnthropicAskProvider(options: AnthropicAskProviderOptions): AskProvider {
  const baseUrl = options.baseUrl ?? "https://api.anthropic.com/v1"
  const fetcher = options.fetcher ?? fetch

  return {
    model: options.embeddingModel,
    embed: options.embed,
    async synthesize(question: string, contexts: AskContext[]) {
      const res = await fetcher(`${baseUrl}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": options.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options.model,
          max_tokens: 600,
          system:
            "Answer using only the supplied CMS contexts. If the answer is not present, say you do not know.",
          messages: [{ role: "user", content: formatAskPrompt(question, contexts) }],
        }),
      })
      const json = (await res.json()) as AnthropicMessagesResponse
      if (!res.ok) throw new Error(json.error?.message ?? `Anthropic request failed: ${res.status}`)
      return (json.content ?? [])
        .map((part) => part.text ?? "")
        .join("")
        .trim()
    },
  }
}

function formatAskPrompt(question: string, contexts: AskContext[]): string {
  const contextText = contexts
    .map((ctx, index) =>
      [`Context ${index + 1}: ${ctx.title}`, ctx.href ? `URL: ${ctx.href}` : "", ctx.text]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n")
  return `Question: ${question}\n\n${contextText}`
}
