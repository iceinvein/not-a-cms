import { afterEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { bootstrapTables, createDatabase, createPageviewStore } from "../../src/index"

const dbPath = "test-core-pageviews-store.db"
const NOW = new Date("2026-06-16T12:00:00.000Z")

function freshStore() {
  const db = createDatabase({ url: dbPath })
  bootstrapTables(db, [])
  return createPageviewStore(db)
}

afterEach(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      unlinkSync(dbPath + suffix)
    } catch {}
  }
})

describe("pageview store", () => {
  test("record increments the current UTC day bucket; summary reports total/today/series", () => {
    const store = freshStore()
    store.record("page", "home", NOW)
    store.record("page", "home", NOW)
    store.record("page", "home", NOW)
    store.record("page", "home", new Date("2026-06-14T09:00:00.000Z")) // 2 days earlier

    const s = store.summary("page", "home", { days: 14, now: NOW })
    expect(s.total).toBe(4)
    expect(s.today).toBe(3)
    expect(s.series.length).toBe(14)
    expect(s.series[13]).toBe(3) // today is the last bucket
    expect(s.series[11]).toBe(1) // two days ago
    expect(s.series[0]).toBe(0) // 13 days ago, untouched
  })

  test("a document with no views is all zeros", () => {
    const store = freshStore()
    const s = store.summary("page", "unseen", { days: 7, now: NOW })
    expect(s.total).toBe(0)
    expect(s.today).toBe(0)
    expect(s.series).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  test("summaries returns a per-document map", () => {
    const store = freshStore()
    store.record("page", "home", NOW)
    const map = store.summaries("page", ["home", "about"], { days: 7, now: NOW })
    expect(map.home.total).toBe(1)
    expect(map.about.total).toBe(0)
  })

  test("a non-finite or non-positive days window falls back to the 14-day default", () => {
    const store = freshStore()
    store.record("page", "home", NOW)
    const nan = store.summary("page", "home", { days: Number.NaN, now: NOW })
    expect(nan.series.length).toBe(14)
    expect(nan.today).toBe(1)
    const zero = store.summary("page", "home", { days: 0, now: NOW })
    expect(zero.series.length).toBe(14)
  })
})
