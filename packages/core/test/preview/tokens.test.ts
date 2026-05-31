import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { unlinkSync } from "node:fs"
import { createDatabase } from "../../src/db/connection"
import { bootstrapTables } from "../../src/db/bootstrap"
import { createPreviewTokenService } from "../../src/preview/tokens"

const testDbPath = "test-preview.db"
let db: ReturnType<typeof createDatabase>
let tokenService: ReturnType<typeof createPreviewTokenService>

describe("preview tokens", () => {
  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [])
    tokenService = createPreviewTokenService(db)
  })

  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("generate() creates a token", () => {
    const t = tokenService.generate("blog_post", "doc-123")
    expect(t.token.length).toBeGreaterThan(20)
    expect(t.collection).toBe("blog_post")
    expect(t.document_id).toBe("doc-123")
  })

  test("validate() returns info for valid token", () => {
    const t = tokenService.generate("blog_post", "doc-123")
    const result = tokenService.validate(t.token)
    expect(result).not.toBeNull()
    expect(result!.collection).toBe("blog_post")
  })

  test("validate() returns null for invalid token", () => {
    expect(tokenService.validate("bad-token")).toBeNull()
  })

  test("validate() returns null for expired token", () => {
    const t = tokenService.generate("blog_post", "doc-123", -1)
    expect(tokenService.validate(t.token)).toBeNull()
  })

  test("generate() reuses valid token for same document", () => {
    const t1 = tokenService.generate("blog_post", "doc-123")
    const t2 = tokenService.generate("blog_post", "doc-123")
    expect(t1.token).toBe(t2.token)
  })

  test("validate() can require matching collection and document metadata", () => {
    const t = tokenService.generate("blog_post", "doc-123")

    expect(tokenService.validate(t.token, { collection: "blog_post", documentId: "doc-123" })).toEqual({
      collection: "blog_post",
      document_id: "doc-123",
    })
    expect(tokenService.validate(t.token, { collection: "page", documentId: "doc-123" })).toBeNull()
    expect(tokenService.validate(t.token, { collection: "blog_post", documentId: "other-doc" })).toBeNull()
  })

  test("revoke() invalidates active tokens for a document", () => {
    const t = tokenService.generate("blog_post", "doc-123")

    const revoked = tokenService.revoke("blog_post", "doc-123")

    expect(revoked).toBe(1)
    expect(tokenService.validate(t.token)).toBeNull()
  })

  test("generate() can regenerate a new token and revoke the previous token", () => {
    const t1 = tokenService.generate("blog_post", "doc-123")
    const t2 = tokenService.generate("blog_post", "doc-123", { regenerate: true })

    expect(t2.token).not.toBe(t1.token)
    expect(tokenService.validate(t1.token)).toBeNull()
    expect(tokenService.validate(t2.token)).toEqual({
      collection: "blog_post",
      document_id: "doc-123",
    })
  })
})
