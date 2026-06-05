import { existsSync, mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { runAdminContentSmoke } from "./admin-content.spec"
import { runMediaPreviewSmoke } from "./media-preview.spec"
import { runAutomationDryRunSmoke } from "./automation-dry-run.spec"
import { runAutomationLiveStreamSmoke } from "./automation-live-stream.spec"

type AgentResult = {
  stdout: string
  stderr: string
  code: number
}

export type E2EContext = {
  apiBase: string
  adminBase: string
  siteBase: string
  outputDir: string
  screenshotDir: string
  session: string
  cookieHeader: string
  agent: (args: string[], options?: { allowFailure?: boolean; json?: boolean }) => Promise<string>
  apiJson: <T = any>(path: string, init?: RequestInit) => Promise<T>
  screenshot: (name: string) => Promise<string>
  assertPageContains: (label: string, expected: string | string[]) => Promise<void>
}

type ScenarioResult = {
  name: string
  details: string[]
}

const rootDir = process.cwd()
const apiPort = process.env.E2E_API_PORT ?? "4821"
const adminPort = process.env.E2E_ADMIN_PORT ?? "4822"
const rendererPort = process.env.E2E_RENDERER_PORT ?? "4823"
const apiBase = `http://localhost:${apiPort}`
const adminBase = `http://localhost:${adminPort}`
const siteBase = `http://localhost:${rendererPort}`
const session = process.env.E2E_AGENT_SESSION ?? `not-a-cms-e2e-${Date.now()}`
const outputDir = join(rootDir, "dogfood-output", "e2e-agent")
const screenshotDir = join(outputDir, "screenshots")
const statePath = join(outputDir, "auth-state.json")
const reportPath = join(outputDir, "report.md")
const runtimeDir = join(rootDir, ".e2e")
const databasePath = join(runtimeDir, "e2e.db")
const uploadsPath = join(runtimeDir, "uploads")

async function main() {
  rmSync(screenshotDir, { recursive: true, force: true })
  rmSync(statePath, { force: true })
  rmSync(reportPath, { force: true })
  mkdirSync(screenshotDir, { recursive: true })
  rmSync(runtimeDir, { recursive: true, force: true })
  mkdirSync(uploadsPath, { recursive: true })

  const dev = Bun.spawn(
    [
      "bun",
      "scripts/dev.ts",
      `--port=${apiPort}`,
      `--admin-port=${adminPort}`,
      `--renderer-port=${rendererPort}`,
    ],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        E2E_TEST_AUTH: "1",
        DATABASE_URL: databasePath,
        MEDIA_STORAGE_PATH: uploadsPath,
        UPLOADS_DIR: uploadsPath,
        BETTER_AUTH_SECRET: "e2e-secret-do-not-use-in-production-xxxxxxxxxxxxxxxx",
        BASE_URL: apiBase,
      },
      stdout: "inherit",
      stderr: "inherit",
    },
  )

  const startedAt = new Date()
  const notes: string[] = []
  const results: ScenarioResult[] = []
  let ctx: E2EContext | null = null
  let failed: unknown = null

  try {
    await Promise.race([
      waitForUrl(`${apiBase}/health`, 20_000),
      dev.exited.then((code) => {
        throw new Error(`dev server exited before health check passed with code ${code}`)
      }),
    ])
    await waitForUrl(adminBase, 25_000)
    await waitForUrl(siteBase, 25_000)

    await runAgent(["open", `${adminBase}/login`])
    await waitForLoad()
    await runAgent(["screenshot", "--annotate", join(screenshotDir, "01-login.png")])

    const email = "e2e-admin@example.test"
    await runAgent(["fill", "input[type=email]", email])
    await runAgent(["click", "button[type=submit]"])

    const magicLink = await waitForMagicLink(email)
    await runAgent(["open", magicLink])
    await waitForLoad()
    await runAgent(["open", adminBase])
    await waitForLoad()
    await runAgent(["state", "save", statePath])
    await runAgent(["screenshot", "--annotate", join(screenshotDir, "02-admin-dashboard.png")])

    const cookieHeader = await getCookieHeader()
    if (!cookieHeader) {
      throw new Error("agent-browser login completed, but no auth cookies were available")
    }

    ctx = createContext(cookieHeader)
    await ctx.assertPageContains("admin dashboard", ["Dashboard", "Blog Posts"])

    // Scenarios are independent: a failure in one is recorded but does not abort
    // the rest, so one flaky/broken scenario cannot hide the others' results.
    const scenarios: Array<{ name: string; run: (ctx: E2EContext) => Promise<ScenarioResult> }> = [
      { name: "Admin content publish smoke", run: runAdminContentSmoke },
      { name: "Media upload and preview smoke", run: runMediaPreviewSmoke },
      { name: "Automation dry-run smoke", run: runAutomationDryRunSmoke },
      { name: "Automation live run streaming smoke", run: runAutomationLiveStreamSmoke },
    ]
    const scenarioFailures: string[] = []
    for (const scenario of scenarios) {
      try {
        results.push(await scenario.run(ctx))
      } catch (err) {
        const message = err instanceof Error ? err.stack || err.message : String(err)
        const slug = scenario.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        scenarioFailures.push(`${scenario.name}: ${message}`)
        results.push({ name: `${scenario.name} (FAILED)`, details: [message.split("\n")[0]] })
        await runAgent(["screenshot", "--annotate", join(screenshotDir, `failure-${slug}.png`)], { allowFailure: true })
      }
    }

    const pageErrors = await runAgent(["errors"], { allowFailure: true })
    const consoleOutput = await runAgent(["console"], { allowFailure: true })
    notes.push("agent-browser page errors:\n" + fenced(pageErrors.trim() || "No page errors reported."))
    notes.push("agent-browser console output:\n" + fenced(consoleOutput.trim() || "No console output reported."))
    const consoleErrors = getConsoleErrors(consoleOutput)
    if (consoleErrors.length > 0) {
      scenarioFailures.push(`agent-browser console reported errors:\n${consoleErrors.join("\n")}`)
    }

    if (scenarioFailures.length > 0) {
      notes.push("Scenario failures:\n" + fenced(scenarioFailures.join("\n\n")))
      failed = new Error(`${scenarioFailures.length} scenario(s) failed:\n${scenarioFailures.join("\n")}`)
    }

    await writeReport({
      status: scenarioFailures.length > 0 ? "FAIL" : "PASS",
      startedAt,
      results,
      notes,
    })
  } catch (err) {
    failed = err
    notes.push(err instanceof Error ? err.stack || err.message : String(err))
    try {
      await runAgent(["screenshot", "--annotate", join(screenshotDir, "failure.png")], { allowFailure: true })
      notes.push("Failure screenshot: screenshots/failure.png")
    } catch {}
    await writeReport({
      status: "FAIL",
      startedAt,
      results,
      notes,
    })
  } finally {
    await runAgent(["close"], { allowFailure: true })
    dev.kill()
    await Promise.race([dev.exited, Bun.sleep(2_000)])
  }

  if (failed) throw failed
}

function createContext(cookieHeader: string): E2EContext {
  return {
    apiBase,
    adminBase,
    siteBase,
    outputDir,
    screenshotDir,
    session,
    cookieHeader,
    agent: async (args, options) => runAgent(args, options),
    apiJson: async <T = any>(path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers)
      headers.set("Cookie", cookieHeader)
      if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json")
      }

      const res = await fetch(`${apiBase}${path}`, { ...init, headers })
      const bodyText = await res.text()
      const data = bodyText ? JSON.parse(bodyText) : null
      if (!res.ok) {
        throw new Error(`${init.method ?? "GET"} ${path} failed with ${res.status}: ${bodyText}`)
      }
      return data as T
    },
    screenshot: async (name: string) => {
      const path = join(screenshotDir, name)
      await runAgent(["screenshot", "--annotate", path])
      return path
    },
    assertPageContains: async (label: string, expected: string | string[]) => {
      const text = await runAgent(["get", "text", "body"])
      const expectedValues = Array.isArray(expected) ? expected : [expected]
      for (const value of expectedValues) {
        if (!text.includes(value)) {
          throw new Error(`Expected ${label} page to contain "${value}"`)
        }
      }
    },
  }
}

async function runAgent(args: string[], options: { allowFailure?: boolean; json?: boolean } = {}): Promise<string> {
  const command = ["agent-browser", "--session", session, ...(options.json ? ["--json"] : []), ...args]
  const result = await spawn(command)
  if (result.code !== 0 && !options.allowFailure) {
    throw new Error(`agent-browser ${args.join(" ")} failed:\n${result.stderr || result.stdout}`)
  }
  return result.stdout
}

async function spawn(command: string[]): Promise<AgentResult> {
  const proc = Bun.spawn(command, {
    cwd: rootDir,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout, stderr, code }
}

async function waitForLoad() {
  await runAgent(["wait", "--load", "networkidle"], { allowFailure: true })
  await runAgent(["wait", "500"], { allowFailure: true })
}

async function waitForUrl(url: string, timeoutMs: number) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {}
    await Bun.sleep(250)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function waitForMagicLink(email: string) {
  const started = Date.now()
  const url = `${apiBase}/api/_test/magic-link?email=${encodeURIComponent(email)}`
  while (Date.now() - started < 10_000) {
    const res = await fetch(url)
    if (res.ok) {
      const body = await res.json() as { url?: string }
      if (body.url) return body.url
    }
    await Bun.sleep(250)
  }
  throw new Error("Timed out waiting for deterministic E2E magic link")
}

async function getCookieHeader() {
  const raw = await runAgent(["cookies", "get"], { json: true })
  const parsed = JSON.parse(raw)
  const cookies = extractCookies(parsed)
  return cookies
    .filter((cookie: { name?: string; value?: string; domain?: string }) => cookie.name && cookie.value && (cookie.domain ?? "").includes("localhost"))
    .map((cookie: { name: string; value: string }) => `${cookie.name}=${cookie.value}`)
    .join("; ")
}

function extractCookies(value: any): Array<{ name: string; value: string; domain?: string }> {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.cookies)) return value.cookies
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.data?.cookies)) return value.data.cookies
  return []
}

async function writeReport(input: {
  status: "PASS" | "FAIL"
  startedAt: Date
  results: ScenarioResult[]
  notes: string[]
}) {
  const screenshots = existsSync(screenshotDir)
    ? Array.from(new Bun.Glob("*.png").scanSync({ cwd: screenshotDir })).sort()
    : []

  const lines = [
    "# not-a-cms Agent Browser E2E Dogfood",
    "",
    `Status: ${input.status}`,
    `Started: ${input.startedAt.toISOString()}`,
    `Finished: ${new Date().toISOString()}`,
    "",
    "## Targets",
    "",
    `- Admin: ${adminBase}`,
    `- API: ${apiBase}`,
    `- Site: ${siteBase}`,
    "",
    "## Scenarios",
    "",
    ...(input.results.length
      ? input.results.flatMap((result) => [
          `### ${result.name}`,
          "",
          ...result.details.map((detail) => `- ${detail}`),
          "",
        ])
      : ["No scenario completed successfully.", ""]),
    "## Screenshots",
    "",
    ...(screenshots.length ? screenshots.map((file) => `- screenshots/${file}`) : ["No screenshots captured."]),
    "",
    "## Notes",
    "",
    ...(input.notes.length ? input.notes : ["No issues found during this smoke run."]),
    "",
  ]

  await Bun.write(reportPath, lines.join("\n"))
}

function fenced(value: string) {
  return ["```", value, "```"].join("\n")
}

function getConsoleErrors(output: string) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("[error]"))
}

await main()
