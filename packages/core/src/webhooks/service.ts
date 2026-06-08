import type { WebhookStore } from "./store"
import type { WebhookConfig, WebhookDelivery, WebhookEvent } from "./types"

const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 5000, 30000]

type WebhookServiceOptions = {
  fetch?: typeof fetch
  retryDelays?: number[]
  timeoutMs?: number
}

export async function createWebhookHeaders(
  body: string,
  secret?: string,
  timestamp = new Date().toISOString(),
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Not-A-CMS-Timestamp": timestamp,
  }
  if (!secret) return headers

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`))
  const value = `sha256=${Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`
  headers["X-Not-A-CMS-Signature"] = value
  headers["X-Webhook-Signature"] = value
  return headers
}

export function createWebhookService(store: WebhookStore, options: WebhookServiceOptions = {}) {
  const fetchImpl = options.fetch ?? fetch
  const retryDelays = options.retryDelays ?? RETRY_DELAYS
  const timeoutMs = options.timeoutMs ?? 10000

  function getMatchingWebhooks(event: WebhookEvent, collection: string): WebhookConfig[] {
    return store.list().filter((hook) => {
      if (!hook.active) return false
      if (!hook.events.includes(event)) return false
      if (hook.collection && hook.collection !== collection) return false
      return true
    })
  }

  async function dispatch(
    event: WebhookEvent,
    collection: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const hooks = getMatchingWebhooks(event, collection)
    for (const hook of hooks) {
      const body = JSON.stringify({
        event,
        collection,
        data: payload,
        timestamp: new Date().toISOString(),
      })
      await deliver(hook, event, body, await createWebhookHeaders(body, hook.secret))
    }
  }

  async function replayDelivery(deliveryId: string): Promise<WebhookDelivery> {
    const delivery = store.getDeliveryLog(deliveryId)
    if (!delivery) throw new Error("Webhook delivery not found")
    if (delivery.status >= 200 && delivery.status < 300)
      throw new Error("Only failed deliveries can be replayed")
    const hook = store.getById(delivery.webhook_id)
    if (!hook) throw new Error("Webhook not found")
    return deliver(
      hook,
      delivery.event,
      delivery.request_body,
      await createWebhookHeaders(delivery.request_body, hook.secret),
    )
  }

  async function deliver(
    hook: WebhookConfig,
    event: WebhookEvent,
    body: string,
    headers: Record<string, string>,
  ): Promise<WebhookDelivery> {
    let lastLog: WebhookDelivery | null = null
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetchImpl(hook.url, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(timeoutMs),
        })
        lastLog = store.logDelivery({
          webhook_id: hook.id,
          event,
          status: res.status,
          request_body: body,
          response_body: await res.text().catch(() => ""),
          attempts: attempt,
        })
        if (res.ok || attempt > retryDelays.length) return lastLog
      } catch (err: any) {
        lastLog = store.logDelivery({
          webhook_id: hook.id,
          event,
          status: 0,
          request_body: body,
          response_body: err.message,
          attempts: attempt,
        })
        if (attempt > retryDelays.length) return lastLog
      }
      await sleep(retryDelays[attempt - 1] ?? 0)
    }
    return (
      lastLog ??
      store.logDelivery({
        webhook_id: hook.id,
        event,
        status: 0,
        request_body: body,
        response_body: "Delivery did not run",
        attempts: 0,
      })
    )
  }

  return { getMatchingWebhooks, dispatch, replayDelivery }
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type WebhookService = ReturnType<typeof createWebhookService>
