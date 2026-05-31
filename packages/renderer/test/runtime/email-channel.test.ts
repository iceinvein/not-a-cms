import { test, expect, describe } from "bun:test"
import { portableTextToEmail, resolveEmailOptions } from "../../src/runtime/email-channel"

describe("portableTextToEmail", () => {
  test("renders paragraph to email HTML", () => {
    const blocks = [{ type: "paragraph", children: [{ type: "text", value: "Hello world" }] }]
    const html = portableTextToEmail(blocks)
    expect(html).toContain("Hello world")
    expect(html).toContain("<!doctype html>")
  })

  test("renders heading blocks", () => {
    const blocks = [{ type: "heading", level: 2, children: [{ type: "text", value: "My Heading" }] }]
    const html = portableTextToEmail(blocks)
    expect(html).toContain("My Heading")
  })

  test("renders bold and italic", () => {
    const blocks = [{ type: "paragraph", children: [{ type: "text", value: "bold", marks: ["bold"] }, { type: "text", value: " and " }, { type: "text", value: "italic", marks: ["italic"] }] }]
    const html = portableTextToEmail(blocks)
    expect(html).toContain("<b>bold</b>")
    expect(html).toContain("<i>italic</i>")
  })

  test("renders images", () => {
    const blocks = [{ type: "image", src: "https://example.com/photo.jpg", alt: "A photo" }]
    const html = portableTextToEmail(blocks)
    expect(html).toContain("https://example.com/photo.jpg")
  })

  test("wraps in template with title", () => {
    const blocks = [{ type: "paragraph", children: [{ type: "text", value: "Content" }] }]
    const html = portableTextToEmail(blocks, { title: "My Newsletter" })
    expect(html).toContain("My Newsletter")
  })

  test("resolves email template metadata from channel settings", () => {
    const options = resolveEmailOptions(
      {
        channels: {
          email: {
            title: "Configured Mail",
            preheader: "Configured preheader",
            footerText: "Configured footer",
            fromName: "Config Team",
            subjectPrefix: "[Config]",
          },
        },
      },
      {
        "channel.email.title": "Saved Mail",
        "channel.email.preheader": "Saved preheader",
        "channel.email.footerText": "Saved footer",
      },
    )

    expect(options).toEqual({
      title: "Saved Mail",
      preheader: "Saved preheader",
      footerText: "Saved footer",
      fromName: "Config Team",
      subjectPrefix: "[Config]",
    })
  })

  test("renders preheader text for email clients", () => {
    const blocks = [{ type: "paragraph", children: [{ type: "text", value: "Content" }] }]
    const html = portableTextToEmail(blocks, { preheader: "Preview this message" })
    expect(html).toContain("Preview this message")
    expect(html).toContain("display:none")
  })
})
