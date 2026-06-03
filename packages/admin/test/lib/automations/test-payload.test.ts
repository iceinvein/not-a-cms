import { describe, expect, test } from "bun:test"
import { defaultPayloadForTrigger, documentToPayload } from "../../../src/lib/automations/test-payload"
import type { FlowTrigger } from "../../../src/components/automations/flow-types"

describe("defaultPayloadForTrigger", () => {
  test("content trigger includes event, collection, empty document", () => {
    const t: FlowTrigger = { type: "content.created", collection: "posts" }
    expect(defaultPayloadForTrigger(t)).toEqual({ event: "content.created", collection: "posts", document: {} })
  })

  test("content trigger without collection omits collection", () => {
    const t: FlowTrigger = { type: "content.updated" }
    expect(defaultPayloadForTrigger(t)).toEqual({ event: "content.updated", document: {} })
  })

  test("webhook trigger", () => {
    const t: FlowTrigger = { type: "webhook.received" }
    expect(defaultPayloadForTrigger(t)).toEqual({ event: "webhook.received" })
  })

  test("cron trigger", () => {
    const t: FlowTrigger = { type: "schedule.cron", cron: "0 0 * * *" }
    expect(defaultPayloadForTrigger(t)).toEqual({ event: "schedule.cron" })
  })
})

describe("documentToPayload", () => {
  test("wraps a document under the trigger event + collection", () => {
    const t: FlowTrigger = { type: "content.created", collection: "posts" }
    expect(documentToPayload(t, { id: "1", title: "Hi" })).toEqual({
      event: "content.created", collection: "posts", document: { id: "1", title: "Hi" },
    })
  })
})
