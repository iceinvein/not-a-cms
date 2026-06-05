import { test, expect, describe } from "bun:test"
import { createRunEventBus, type RunEvent } from "../../src/automations/events"

const sample: RunEvent = {
  type: "run.completed",
  run: {
    id: "r1", flow_id: "f1", trigger_event: "content.created",
    status: "completed", started_at: "2026-06-05T00:00:00.000Z",
    finished_at: "2026-06-05T00:00:01.000Z",
  },
}

describe("createRunEventBus", () => {
  test("delivers published events to every subscriber", () => {
    const bus = createRunEventBus()
    const a: RunEvent[] = []
    const b: RunEvent[] = []
    bus.subscribe((e) => a.push(e))
    bus.subscribe((e) => b.push(e))
    bus.publish(sample)
    expect(a).toEqual([sample])
    expect(b).toEqual([sample])
  })

  test("the returned unsubscribe stops delivery", () => {
    const bus = createRunEventBus()
    const seen: RunEvent[] = []
    const off = bus.subscribe((e) => seen.push(e))
    off()
    bus.publish(sample)
    expect(seen).toHaveLength(0)
  })

  test("a throwing subscriber cannot starve the others", () => {
    const bus = createRunEventBus()
    const seen: RunEvent[] = []
    bus.subscribe(() => { throw new Error("boom") })
    bus.subscribe((e) => seen.push(e))
    expect(() => bus.publish(sample)).not.toThrow()
    expect(seen).toHaveLength(1)
  })
})
