import type { ChannelConfig } from "@not-a-cms/core"
import mjml2html from "mjml"
import type { PTBlock, PTTextNode } from "./block-renderer"

type EmailOptions = {
  title?: string
  preheader?: string
  siteUrl?: string
  footerText?: string
  fromName?: string
  subjectPrefix?: string
}

type EmailRuntimeInput = {
  channels?: ChannelConfig
}

const DEFAULT_EMAIL = {
  footerText: "Powered by not-a-cms",
}

export function resolveEmailOptions(
  input: EmailRuntimeInput = {},
  settings: Record<string, string> = {},
): EmailOptions {
  const configured = input.channels?.email ?? {}
  return {
    title: settingOrConfig(settings, "channel.email.title", configured.title),
    preheader: settingOrConfig(settings, "channel.email.preheader", configured.preheader),
    footerText: settingOrConfig(
      settings,
      "channel.email.footerText",
      configured.footerText,
      DEFAULT_EMAIL.footerText,
    ),
    fromName: settingOrConfig(settings, "channel.email.fromName", configured.fromName),
    subjectPrefix: settingOrConfig(
      settings,
      "channel.email.subjectPrefix",
      configured.subjectPrefix,
    ),
  }
}

function blocksToMjml(blocks: PTBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "paragraph": {
          const html = renderEmailText((block.children || []) as PTTextNode[])
          return `<mj-text>${html}</mj-text>`
        }
        case "heading": {
          const level = block.level || 2
          const html = renderEmailText((block.children || []) as PTTextNode[])
          const fontSize = level === 1 ? "28px" : level === 2 ? "24px" : "20px"
          return `<mj-text font-size="${fontSize}" font-weight="700" padding-bottom="8px">${html}</mj-text>`
        }
        case "blockquote": {
          const inner = blocksToMjml((block.children || []) as PTBlock[])
          return `<mj-section border-left="4px solid #e5e7eb" padding-left="16px"><mj-column>${inner}</mj-column></mj-section>`
        }
        case "image":
          return `<mj-image src="${block.src || block.url || ""}" alt="${block.alt || ""}" />`
        case "divider":
          return `<mj-divider />`
        case "codeBlock":
          return `<mj-text font-family="monospace" background-color="#f3f4f6" padding="12px"><pre>${escapeHtml(String(block.code || ""))}</pre></mj-text>`
        default:
          return ""
      }
    })
    .filter(Boolean)
    .join("\n")
}

function renderEmailText(children: PTTextNode[]): string {
  return children
    .map((child) => {
      if (child.type !== "text") return ""
      let html = escapeHtml(child.value)
      if (child.marks) {
        for (const mark of child.marks) {
          if (mark === "bold") html = `<b>${html}</b>`
          else if (mark === "italic") html = `<i>${html}</i>`
          else if (mark === "code") html = `<code>${html}</code>`
          else if (typeof mark === "object" && mark.type === "link") {
            html = `<a href="${escapeHtml(mark.href || "")}">${html}</a>`
          }
        }
      }
      return html
    })
    .join("")
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function portableTextToEmail(blocks: PTBlock[], options: EmailOptions = {}): string {
  const { title = "", footerText = "Powered by not-a-cms" } = options
  const bodyMjml = blocksToMjml(blocks)
  const preheader = options.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(options.preheader)}</div>`
    : ""

  const mjmlTemplate = `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="system-ui, -apple-system, sans-serif" />
      <mj-text font-size="16px" line-height="1.6" color="#1f2937" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f9fafb">
    <mj-raw>${preheader}</mj-raw>
    <mj-section background-color="#ffffff" padding="32px">
      <mj-column>
        ${title ? `<mj-text font-size="28px" font-weight="700" padding-bottom="16px">${escapeHtml(title)}</mj-text>` : ""}
        ${bodyMjml}
      </mj-column>
    </mj-section>
    <mj-section padding="16px">
      <mj-column>
        <mj-text font-size="12px" color="#9ca3af" align="center">${escapeHtml(footerText)}</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`

  const { html } = (mjml2html as unknown as (template: string) => { html: string })(mjmlTemplate)
  return html
}

function settingOrConfig(
  settings: Record<string, string>,
  key: string,
  configured?: string,
  fallback?: string,
): string | undefined {
  const value = settings[key] ?? configured ?? fallback
  if (typeof value !== "string") return fallback
  return value.trim() || fallback
}

export type { EmailOptions, EmailRuntimeInput }
