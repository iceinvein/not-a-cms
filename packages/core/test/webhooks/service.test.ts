import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { bootstrapTables } from "../../src/db/bootstrap"
import { createDatabase } from "../../src/db/connection"
import { createWebhookHeaders, createWebhookService } from "../../src/webhooks/service"
import { createWebhookStore } from "../../src/webhooks/store"

const testDbPath = "test-webhooks.db"
let db: ReturnType<typeof createDatabase>
let store: ReturnType<typeof createWebhookStore>
let webhookService: ReturnType<typeof createWebhookService>

describe("webhook system", () => {
  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [])
    store = createWebhookStore(db)
    webhookService = createWebhookService(store)
  })

  afterEach(() => {
    try {
      unlinkSync(testDbPath)
    } catch {}
    try {
      unlinkSync(testDbPath + "-wal")
    } catch {}
    try {
      unlinkSync(testDbPath + "-shm")
    } catch {}
  })

  test("store.create() creates a webhook", () => {
    const hook = store.create({
      url: "https://example.com/webhook",
      events: ["content:afterPublish"],
      active: true,
    })
    expect(hook.id).toBeDefined()
    expect(hook.url).toBe("https://example.com/webhook")
  })

  test("store.list() returns all webhooks", () => {
    store.create({ url: "https://a.com", events: ["content:afterSave"], active: true })
    store.create({ url: "https://b.com", events: ["content:afterDelete"], active: true })
    expect(store.list()).toHaveLength(2)
  })

  test("store.remove() deletes a webhook", () => {
    const hook = store.create({ url: "https://a.com", events: ["content:afterSave"], active: true })
    store.remove(hook.id)
    expect(store.list()).toHaveLength(0)
  })

  test("store.update() modifies a webhook", () => {
    const hook = store.create({ url: "https://a.com", events: ["content:afterSave"], active: true })
    const updated = store.update(hook.id, { url: "https://b.com" })
    expect(updated?.url).toBe("https://b.com")
  })

  test("service.getMatchingWebhooks() returns hooks matching event and collection", () => {
    store.create({
      url: "https://a.com",
      events: ["content:afterPublish"],
      collection: "blog_post",
      active: true,
    })
    store.create({ url: "https://b.com", events: ["content:afterPublish"], active: true })
    store.create({ url: "https://c.com", events: ["content:afterDelete"], active: true })
    const matches = webhookService.getMatchingWebhooks("content:afterPublish", "blog_post")
    expect(matches).toHaveLength(2)
  })

  test("service.getMatchingWebhooks() excludes inactive webhooks", () => {
    store.create({ url: "https://a.com", events: ["content:afterPublish"], active: false })
    expect(webhookService.getMatchingWebhooks("content:afterPublish", "blog_post")).toHaveLength(0)
  })

  test("store.logDelivery() records a delivery", () => {
    const hook = store.create({
      url: "https://a.com",
      events: ["content:afterPublish"],
      active: true,
    })
    store.logDelivery({
      webhook_id: hook.id,
      event: "content:afterPublish",
      status: 200,
      request_body: '{"test":true}',
      response_body: "ok",
      attempts: 1,
    })
    const logs = store.getDeliveryLogs(hook.id)
    expect(logs).toHaveLength(1)
    expect(logs[0].status).toBe(200)
  })

  test("createWebhookHeaders() signs payloads with timestamped HMAC headers", async () => {
    const headers = await createWebhookHeaders("payload", "secret", "2026-05-31T00:00:00.000Z")

    expect(headers["Content-Type"]).toBe("application/json")
    expect(headers["X-Not-A-CMS-Timestamp"]).toBe("2026-05-31T00:00:00.000Z")
    expect(headers["X-Not-A-CMS-Signature"]).toStartWith("sha256=")
    expect(headers["X-Webhook-Signature"]).toBe(headers["X-Not-A-CMS-Signature"])
  })

  test("service.dispatch() stores bounded response snippets", async () => {
    store.create({ url: "https://a.com", events: ["content:afterPublish"], active: true })
    webhookService = createWebhookService(store, {
      fetch: async () => new Response("x".repeat(3000), { status: 500 }),
      retryDelays: [],
    })

    await webhookService.dispatch("content:afterPublish", "blog_post", { id: "doc-1" })

    const logs = store.getDeliveryLogs(store.list()[0].id)
    expect(logs).toHaveLength(1)
    expect(logs[0].status).toBe(500)
    expect(logs[0].response_body?.length).toBeLessThanOrEqual(2048)
  })

  test("service.replayDelivery() re-sends a failed delivery and records a new log", async () => {
    const hook = store.create({
      url: "https://a.com",
      events: ["content:afterPublish"],
      secret: "secret",
      active: true,
    })
    const failed = store.logDelivery({
      webhook_id: hook.id,
      event: "content:afterPublish",
      status: 500,
      request_body: JSON.stringify({ event: "content:afterPublish", data: { id: "doc-1" } }),
      response_body: "failed",
      attempts: 1,
    })
    const seenHeaders: Record<string, string>[] = []
    webhookService = createWebhookService(store, {
      fetch: async (_url, init) => {
        seenHeaders.push(Object.fromEntries(new Headers(init?.headers as HeadersInit).entries()))
        return new Response("ok", { status: 200 })
      },
      retryDelays: [],
    })

    const replay = await webhookService.replayDelivery(failed.id)

    expect(replay.status).toBe(200)
    expect(store.getDeliveryLogs(hook.id)).toHaveLength(2)
    expect(seenHeaders[0]["x-not-a-cms-signature"]).toStartWith("sha256=")
  })
})
