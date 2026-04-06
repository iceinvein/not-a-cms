import { sql } from "drizzle-orm"
import type { AppDatabase } from "../db/connection"
import type { WebhookConfig, WebhookDelivery, WebhookEvent } from "./types"

type CreateWebhookInput = {
  url: string
  events: WebhookEvent[]
  collection?: string
  secret?: string
  active: boolean
}

export function createWebhookStore(db: AppDatabase) {
  function create(input: CreateWebhookInput): WebhookConfig {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const eventsJson = JSON.stringify(input.events)
    db.run(sql`INSERT INTO _webhooks (id, url, events, collection, secret, active, created_at) VALUES (${id}, ${input.url}, ${eventsJson}, ${input.collection ?? null}, ${input.secret ?? null}, ${input.active ? 1 : 0}, ${now})`)
    return { id, ...input, created_at: now }
  }

  function list(): WebhookConfig[] {
    const rows = db.all(sql`SELECT * FROM _webhooks ORDER BY created_at DESC`)
    return (rows as any[]).map(parseRow)
  }

  function getById(id: string): WebhookConfig | null {
    const rows = db.all(sql`SELECT * FROM _webhooks WHERE id = ${id}`)
    const row = (rows as any[])[0]
    return row ? parseRow(row) : null
  }

  function update(id: string, data: Partial<CreateWebhookInput>): WebhookConfig | null {
    const existing = getById(id)
    if (!existing) return null
    const merged = { ...existing, ...data }
    db.run(sql`UPDATE _webhooks SET url = ${merged.url}, events = ${JSON.stringify(merged.events)}, collection = ${merged.collection ?? null}, secret = ${merged.secret ?? null}, active = ${merged.active ? 1 : 0} WHERE id = ${id}`)
    return getById(id)
  }

  function remove(id: string): boolean {
    db.run(sql`DELETE FROM _webhooks WHERE id = ${id}`)
    return true
  }

  function logDelivery(input: Omit<WebhookDelivery, "id" | "created_at">): void {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    db.run(sql`INSERT INTO _webhook_logs (id, webhook_id, event, status, request_body, response_body, attempts, created_at) VALUES (${id}, ${input.webhook_id}, ${input.event}, ${input.status}, ${input.request_body}, ${input.response_body ?? null}, ${input.attempts}, ${now})`)
  }

  function getDeliveryLogs(webhookId: string, limit = 50): WebhookDelivery[] {
    const rows = db.all(sql`SELECT * FROM _webhook_logs WHERE webhook_id = ${webhookId} ORDER BY created_at DESC LIMIT ${limit}`)
    return rows as WebhookDelivery[]
  }

  return { create, list, getById, update, remove, logDelivery, getDeliveryLogs }
}

function parseRow(row: any): WebhookConfig {
  return { ...row, events: typeof row.events === "string" ? JSON.parse(row.events) : row.events, active: Boolean(row.active) }
}

export type WebhookStore = ReturnType<typeof createWebhookStore>
