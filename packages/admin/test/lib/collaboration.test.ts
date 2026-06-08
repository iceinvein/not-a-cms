import { describe, expect, test } from "bun:test"
import {
  buildCollaborationConfig,
  collabServerUrl,
  contentCollabDocumentId,
} from "../../src/lib/collaboration"

describe("admin collaboration config", () => {
  test("creates stable document ids per content field", () => {
    expect(contentCollabDocumentId("blog_post", "doc-1", "body")).toBe(
      "content:blog_post:doc-1:body",
    )
  })

  test("derives websocket URLs from API bases", () => {
    expect(collabServerUrl("http://localhost:4321")).toBe("ws://localhost:4321/collab")
    expect(collabServerUrl("https://cms.example.test/base")).toBe(
      "wss://cms.example.test/base/collab",
    )
  })

  test("only builds config for saved documents", () => {
    expect(
      buildCollaborationConfig({
        apiBase: "http://localhost:4321",
        collection: "blog_post",
        documentId: undefined,
        fieldName: "body",
        user: { name: "Editor", color: "#c9956b" },
      }),
    ).toBeNull()

    expect(
      buildCollaborationConfig({
        apiBase: "http://localhost:4321",
        collection: "blog_post",
        documentId: "doc-1",
        fieldName: "body",
        user: { name: "Editor", color: "#c9956b" },
      }),
    ).toEqual({
      serverUrl: "ws://localhost:4321/collab",
      documentId: "content:blog_post:doc-1:body",
      user: { name: "Editor", color: "#c9956b" },
    })
  })
})
