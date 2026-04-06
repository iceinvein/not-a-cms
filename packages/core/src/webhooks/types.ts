export type WebhookEvent =
  | "content:afterSave"
  | "content:afterPublish"
  | "content:afterDelete"
  | "media:afterUpload"

export type WebhookConfig = {
  id: string
  url: string
  events: WebhookEvent[]
  collection?: string
  secret?: string
  active: boolean
  created_at: string
}

export type WebhookDelivery = {
  id: string
  webhook_id: string
  event: WebhookEvent
  status: number
  request_body: string
  response_body?: string
  attempts: number
  created_at: string
}
