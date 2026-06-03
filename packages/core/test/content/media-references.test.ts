import { describe, expect, test } from "bun:test"
import { defineCollection } from "../../src/schema/collection"
import { field } from "../../src/schema/field"
import { extractMediaReferences } from "../../src/content/media-references"

const post = defineCollection({
  name: "post",
  fields: {
    title: field.text({ required: true }),
    cover: field.media({ accept: ["image/*"] }),
    body: field.richText(),
  },
})

describe("extractMediaReferences", () => {
  test("captures a media field reference with label", () => {
    const refs = extractMediaReferences(post, { id: "p1", title: "Launch", cover: "img1" })
    expect(refs).toEqual([{ assetId: "img1", field: "cover", label: "Launch" }])
  })

  test("ignores empty/missing media fields", () => {
    expect(extractMediaReferences(post, { id: "p1", title: "X", cover: "" })).toEqual([])
    expect(extractMediaReferences(post, { id: "p1", title: "X" })).toEqual([])
  })

  test("captures rich-text image (id and mediaId) and gallery ids", () => {
    const body = [
      { type: "image", id: "img2", url: "/x" },
      { type: "image", mediaId: "img3", src: "/y" },
      { type: "gallery", images: [{ id: "img4", url: "/a" }, { id: "img5", url: "/b" }] },
      { type: "paragraph", children: [{ text: "no media" }] },
    ]
    const refs = extractMediaReferences(post, { id: "p1", title: "Launch", body })
    expect(refs.map((r) => r.assetId).sort()).toEqual(["img2", "img3", "img4", "img5"])
    expect(refs.every((r) => r.field === "body" && r.label === "Launch")).toBe(true)
  })

  test("parses rich-text stored as a JSON string and dedupes per (field, asset)", () => {
    const body = JSON.stringify([
      { type: "image", id: "imgDup" },
      { type: "image", id: "imgDup" },
    ])
    const refs = extractMediaReferences(post, { id: "p1", title: "L", body })
    expect(refs).toEqual([{ assetId: "imgDup", field: "body", label: "L" }])
  })

  test("label falls back title -> name -> slug -> id", () => {
    expect(extractMediaReferences(post, { name: "my-name", cover: "i" })[0].label).toBe("my-name")
    expect(extractMediaReferences(post, { slug: "my-slug", cover: "i" })[0].label).toBe("my-slug")
    expect(extractMediaReferences(post, { id: "p9", cover: "i" })[0].label).toBe("p9")
  })
})
