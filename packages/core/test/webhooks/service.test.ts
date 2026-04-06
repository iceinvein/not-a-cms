import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { unlinkSync } from "node:fs"
import { createDatabase } from "../../src/db/connection"
import { bootstrapTables } from "../../src/db/bootstrap"
import { createWebhookStore } from "../../src/webhooks/store"
import { createWebhookService } from "../../src/webhooks/service"

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
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("store.create() creates a webhook", () => {
    const hook = store.create({ url: "https://example.com/webhook", events: ["content:afterPublish"], active: true })
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
    store.create({ url: "https://a.com", events: ["content:afterPublish"], collection: "blog_post", active: true })
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
    const hook = store.create({ url: "https://a.com", events: ["content:afterPublish"], active: true })
    store.logDelivery({ webhook_id: hook.id, event: "content:afterPublish", status: 200, request_body: '{"test":true}', response_body: "ok", attempts: 1 })
    const logs = store.getDeliveryLogs(hook.id)
    expect(logs).toHaveLength(1)
    expect(logs[0].status).toBe(200)
  })
})
