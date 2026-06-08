import type { E2EContext } from "./agent-browser-e2e"

type FlowRecord = { id: string }

/**
 * Drives the automation dry-run ("Test rule") feature through the admin UI:
 * creates an inactive flow, opens the rule editor, runs a dry-run from the Test
 * panel, asserts the inspector shows Simulated badges + resolved "would ..."
 * summaries, then proves the zero-side-effect / ephemeral guarantee by checking
 * that nothing was persisted (no run, no created content).
 */
export async function runAutomationDryRunSmoke(ctx: E2EContext) {
  const stamp = Date.now()

  // Inactive flow: email + create_content, chained. Tests "before enabling it".
  const flow = await ctx.apiJson<FlowRecord>("/api/_flows", {
    method: "POST",
    body: JSON.stringify({
      name: `Dry Run Demo ${stamp}`,
      active: false,
      trigger: { type: "content.created", collection: "blog_post" },
      steps: [
        {
          id: "a1",
          type: "action.email",
          config: { to: "editor@demo.test", subject: "New: {{document.title}}" },
          next: "a2",
        },
        {
          id: "a2",
          type: "action.create_content",
          config: { collection: "author", data: { name: "Mirror of {{document.title}}" } },
          next: null,
        },
      ],
    }),
  })

  // Baseline counts before the dry-run.
  const runsBefore = await ctx.apiJson<{ data: unknown[] }>(`/api/_flows/${flow.id}/runs`)
  const authorsBefore = await ctx.apiJson<{ data: unknown[] }>("/api/author")

  // Open the rule editor.
  await ctx.agent(["open", `${ctx.adminBase}/automations/${flow.id}`])
  await ctx.agent(["wait", "--load", "networkidle"], { allowFailure: true })
  await ctx.agent(["wait", "800"], { allowFailure: true })
  await ctx.screenshot("07-dry-run-rule-editor.png")

  const hasTestButton = (
    await ctx.agent([
      "eval",
      `[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Test')`,
    ])
  ).trim()
  if (!hasTestButton.includes("true")) {
    throw new Error("Test button not found in the rule editor")
  }

  // Open the Test panel.
  await ctx.agent([
    "eval",
    `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Test').click()`,
  ])
  await ctx.agent(["wait", "600"], { allowFailure: true })
  await ctx.screenshot("08-dry-run-panel.png")
  await ctx.assertPageContains("dry-run test panel", ["Test rule", "Test payload"])

  // Fill the controlled React textarea via the native setter + an input event.
  const payload = JSON.stringify({
    event: "content.created",
    collection: "blog_post",
    document: { title: "Hello World" },
  })
  await ctx.agent([
    "eval",
    `(() => { const ta = document.getElementById('dry-run-payload'); const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; set.call(ta, ${JSON.stringify(payload)}); ta.dispatchEvent(new Event('input', { bubbles: true })); return ta.value.length; })()`,
  ])

  // Run the dry-run.
  await ctx.agent([
    "eval",
    `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Run test').click()`,
  ])
  await ctx.agent(["wait", "--load", "networkidle"], { allowFailure: true })
  await ctx.agent(["wait", "800"], { allowFailure: true })
  await ctx.screenshot("09-dry-run-result.png")

  await ctx.assertPageContains("dry-run result", [
    "Simulated",
    "would email editor@demo.test",
    "would create in",
    "Hello World",
  ])

  // Zero-side-effect / ephemeral guarantee: nothing persisted.
  const runsAfter = await ctx.apiJson<{ data: unknown[] }>(`/api/_flows/${flow.id}/runs`)
  const authorsAfter = await ctx.apiJson<{ data: unknown[] }>("/api/author")
  if (runsAfter.data.length !== runsBefore.data.length) {
    throw new Error(
      `Dry-run persisted a run (before ${runsBefore.data.length}, after ${runsAfter.data.length})`,
    )
  }
  if (authorsAfter.data.length !== authorsBefore.data.length) {
    throw new Error(
      `Dry-run created content (authors before ${authorsBefore.data.length}, after ${authorsAfter.data.length})`,
    )
  }

  return {
    name: "Automation dry-run smoke",
    details: [
      `Created inactive flow ${flow.id} (email + create_content).`,
      "Opened the rule editor and launched the Test panel with agent-browser.",
      "Ran a dry-run; the inspector showed Simulated badges and resolved 'would ...' summaries.",
      "Confirmed zero side effects: no run persisted and no content created.",
    ],
  }
}
