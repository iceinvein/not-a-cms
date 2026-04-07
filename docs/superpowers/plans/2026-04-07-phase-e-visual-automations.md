# Phase E: Visual Automations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can create event-driven automation flows (trigger → condition → action) through a visual builder UI, with full execution replay for debugging.

**Architecture:** Flows are JSON documents stored in `_flows` table. A synchronous graph-walker engine executes steps sequentially, recording per-step input/output in `_flow_run_steps` for replay. Content lifecycle events dispatch to the engine via an optional dependency injected into `createContentService`. The admin UI renders flows as a vertical step list with @dnd-kit drag-and-drop, and the replay debugger overlays execution data onto the same canvas.

**Tech Stack:** Bun, Drizzle ORM (bun:sqlite), React, @dnd-kit, Tailwind, Astro, MJML (existing from Phase C)

---

## Execution Waves

```
Wave 1:  E1 Types + Store + DB Tables
Wave 2:  E2 Engine (graph walker + payload threading + condition evaluator)
Wave 3:  E3 Content Service Integration + Cron + REST API
Wave 4:  E4 Admin UI — Flow List + Flow Editor + Canvas
Wave 5:  E5 Admin UI — Step Configurator + Execution Viewer
```

---

## File Structure (all changes)

```
packages/
  core/src/
    automations/
      types.ts                       CREATE - Flow, FlowTrigger, FlowStep, ConditionRule, ActionType, FlowRun, FlowRunStep
      store.ts                       CREATE - CRUD for _flows, _flow_runs, _flow_run_steps
      engine.ts                      CREATE - executeFlow(), evaluateCondition(), executeAction(), resolvePayloadPath(), interpolate()
      cron.ts                        CREATE - matchesCron(), createAutomationCron()
    content/
      service.ts                     MODIFY - add automations dispatcher param
    db/
      bootstrap.ts                   MODIFY - add _flows, _flow_runs, _flow_run_steps tables
    index.ts                         MODIFY - export automations modules
  core/test/
    automations/
      types.test.ts                  CREATE
      store.test.ts                  CREATE
      engine.test.ts                 CREATE
      cron.test.ts                   CREATE
    content/
      service.test.ts                MODIFY - add automation dispatch tests
  server/src/
    automations/
      handler.ts                     CREATE - REST routes for flows, runs, inbound trigger
    rest/
      handler.ts                     MODIFY - mount _flows routes
    index.ts                         MODIFY - wire automation store, engine, cron, dispatcher
  server/test/
    automations/
      handler.test.ts                CREATE
  admin/src/
    components/
      automations/
        FlowList.tsx                 CREATE - list all flows with toggle/delete
        FlowEditor.tsx               CREATE - top bar + canvas + config panel shell
        FlowCanvas.tsx               CREATE - vertical step rendering with connectors
        StepConfigurator.tsx          CREATE - contextual config forms per step type
        StepPicker.tsx               CREATE - popup to add condition or action
        RunList.tsx                  CREATE - paginated execution history table
        RunDetail.tsx                CREATE - replay view with color-coded steps + JSON viewer
    pages/
      automations/
        index.astro                  CREATE - flow list page
        [id].astro                   CREATE - flow editor page
    components/
      Sidebar.astro                  MODIFY - add Automations link
```

---

## Task E1: Types + Store + DB Tables

**Files:**
- Create: `packages/core/src/automations/types.ts`
- Create: `packages/core/src/automations/store.ts`
- Create: `packages/core/test/automations/types.test.ts`
- Create: `packages/core/test/automations/store.test.ts`
- Modify: `packages/core/src/db/bootstrap.ts`
- Modify: `packages/core/src/index.ts`

### Step 1: Write the type definitions

- [ ] **Create `packages/core/src/automations/types.ts`**

```typescript
export type FlowTrigger =
  | { type: "content.created"; collection?: string }
  | { type: "content.updated"; collection?: string }
  | { type: "content.published"; collection?: string }
  | { type: "content.deleted"; collection?: string }
  | { type: "webhook.received" }
  | { type: "schedule.cron"; cron: string }

export type ConditionOperator = "eq" | "neq" | "contains" | "not_contains" | "matches" | "gt" | "lt"

export type ConditionRule = {
  field: string
  operator: ConditionOperator
  value: string | number | boolean
}

export type ConditionStep = {
  id: string
  type: "condition"
  label?: string
  rules: ConditionRule[]
  match: "all" | "any"
  branches: {
    true: string | null
    false: string | null
  }
}

export type ActionType =
  | "action.webhook"
  | "action.email"
  | "action.create_content"
  | "action.update_content"
  | "action.delete_content"
  | "action.log"
  | "action.transform"

export type ActionStep = {
  id: string
  type: ActionType
  label?: string
  config: Record<string, unknown>
  next: string | null
}

export type FlowStep = ConditionStep | ActionStep

export type Flow = {
  id: string
  name: string
  description?: string
  active: boolean
  trigger: FlowTrigger
  steps: FlowStep[]
  created_at: string
  updated_at: string
}

export type FlowRunStatus = "running" | "completed" | "failed"
export type FlowRunStepStatus = "running" | "completed" | "failed" | "skipped"

export type FlowRun = {
  id: string
  flow_id: string
  trigger_event: string
  trigger_payload?: string
  status: FlowRunStatus
  started_at: string
  finished_at?: string
  error?: string
}

export type FlowRunStep = {
  id: string
  run_id: string
  step_id: string
  status: FlowRunStepStatus
  input?: string
  output?: string
  branch_taken?: string
  started_at: string
  finished_at?: string
  error?: string
}

export type CreateFlowInput = {
  name: string
  description?: string
  trigger: FlowTrigger
  steps: FlowStep[]
  active?: boolean
}

export type TriggerPayload = {
  event: string
  collection?: string
  document?: Record<string, unknown>
  body?: unknown
  headers?: Record<string, string>
  timestamp?: string
}
```

### Step 2: Write failing store tests

- [ ] **Create `packages/core/test/automations/store.test.ts`**

```typescript
import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { unlinkSync } from "node:fs"
import { createDatabase } from "../../src/db/connection"
import { bootstrapTables } from "../../src/db/bootstrap"
import { createFlowStore } from "../../src/automations/store"

const testDbPath = "test-automations-store.db"
let db: ReturnType<typeof createDatabase>
let store: ReturnType<typeof createFlowStore>

describe("flow store", () => {
  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [])
    store = createFlowStore(db)
  })

  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("createFlow() creates and returns a flow", () => {
    const flow = store.createFlow({
      name: "Notify on publish",
      trigger: { type: "content.published" },
      steps: [],
    })
    expect(flow.id).toBeDefined()
    expect(flow.name).toBe("Notify on publish")
    expect(flow.active).toBe(true)
    expect(flow.steps).toEqual([])
  })

  test("listFlows() returns all flows", () => {
    store.createFlow({ name: "Flow A", trigger: { type: "content.created" }, steps: [] })
    store.createFlow({ name: "Flow B", trigger: { type: "content.deleted" }, steps: [] })
    expect(store.listFlows()).toHaveLength(2)
  })

  test("getFlowById() retrieves a flow", () => {
    const created = store.createFlow({ name: "Find Me", trigger: { type: "webhook.received" }, steps: [] })
    const found = store.getFlowById(created.id)
    expect(found).not.toBeNull()
    expect(found!.name).toBe("Find Me")
  })

  test("getFlowById() returns null for missing flow", () => {
    expect(store.getFlowById("nonexistent")).toBeNull()
  })

  test("updateFlow() modifies a flow", () => {
    const created = store.createFlow({ name: "Old Name", trigger: { type: "content.created" }, steps: [] })
    const updated = store.updateFlow(created.id, { name: "New Name" })
    expect(updated!.name).toBe("New Name")
  })

  test("deleteFlow() removes a flow", () => {
    const created = store.createFlow({ name: "To Delete", trigger: { type: "content.created" }, steps: [] })
    store.deleteFlow(created.id)
    expect(store.listFlows()).toHaveLength(0)
  })

  test("toggleFlow() flips active state", () => {
    const created = store.createFlow({ name: "Toggle Me", trigger: { type: "content.created" }, steps: [] })
    expect(created.active).toBe(true)
    const toggled = store.toggleFlow(created.id)
    expect(toggled!.active).toBe(false)
    const toggledBack = store.toggleFlow(created.id)
    expect(toggledBack!.active).toBe(true)
  })

  test("getActiveFlowsByTrigger() filters by trigger type", () => {
    store.createFlow({ name: "A", trigger: { type: "content.published", collection: "posts" }, steps: [] })
    store.createFlow({ name: "B", trigger: { type: "content.published" }, steps: [] })
    store.createFlow({ name: "C", trigger: { type: "content.deleted" }, steps: [] })
    store.createFlow({ name: "D", trigger: { type: "content.published" }, steps: [], active: false })
    const matches = store.getActiveFlowsByTrigger("content.published")
    expect(matches).toHaveLength(2)
  })

  test("createRun() and getRun() persist run data", () => {
    const flow = store.createFlow({ name: "F", trigger: { type: "content.created" }, steps: [] })
    const run = store.createRun(flow.id, "content.created", '{"event":"content.created"}')
    expect(run.status).toBe("running")
    const fetched = store.getRun(run.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.flow_id).toBe(flow.id)
  })

  test("completeRun() sets status and finished_at", () => {
    const flow = store.createFlow({ name: "F", trigger: { type: "content.created" }, steps: [] })
    const run = store.createRun(flow.id, "content.created", "{}")
    store.completeRun(run.id, "completed")
    const updated = store.getRun(run.id)
    expect(updated!.status).toBe("completed")
    expect(updated!.finished_at).toBeDefined()
  })

  test("completeRun() with error sets error field", () => {
    const flow = store.createFlow({ name: "F", trigger: { type: "content.created" }, steps: [] })
    const run = store.createRun(flow.id, "content.created", "{}")
    store.completeRun(run.id, "failed", "Something broke")
    const updated = store.getRun(run.id)
    expect(updated!.status).toBe("failed")
    expect(updated!.error).toBe("Something broke")
  })

  test("recordStep() persists step execution data", () => {
    const flow = store.createFlow({ name: "F", trigger: { type: "content.created" }, steps: [] })
    const run = store.createRun(flow.id, "content.created", "{}")
    store.recordStep({
      run_id: run.id,
      step_id: "s1",
      status: "completed",
      input: '{"a":1}',
      output: '{"b":2}',
    })
    const steps = store.getRunSteps(run.id)
    expect(steps).toHaveLength(1)
    expect(steps[0].step_id).toBe("s1")
    expect(steps[0].input).toBe('{"a":1}')
  })

  test("listRuns() returns runs for a flow with pagination", () => {
    const flow = store.createFlow({ name: "F", trigger: { type: "content.created" }, steps: [] })
    store.createRun(flow.id, "content.created", "{}")
    store.createRun(flow.id, "content.created", "{}")
    store.createRun(flow.id, "content.created", "{}")
    const page1 = store.listRuns(flow.id, 2, 0)
    expect(page1).toHaveLength(2)
    const page2 = store.listRuns(flow.id, 2, 2)
    expect(page2).toHaveLength(1)
  })

  test("purgeOldRuns() removes runs older than cutoff", () => {
    const flow = store.createFlow({ name: "F", trigger: { type: "content.created" }, steps: [] })
    const run = store.createRun(flow.id, "content.created", "{}")
    // Manually backdate the run
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
    const { sql } = require("drizzle-orm")
    db.run(sql`UPDATE _flow_runs SET started_at = ${oldDate} WHERE id = ${run.id}`)
    const purged = store.purgeOldRuns(30)
    expect(purged).toBe(1)
    expect(store.listRuns(flow.id)).toHaveLength(0)
  })
})
```

- [ ] **Run tests to verify they fail**

Run: `cd packages/core && bun test test/automations/store.test.ts`
Expected: FAIL — modules not found

### Step 3: Add DB tables to bootstrap

- [ ] **Modify `packages/core/src/db/bootstrap.ts`** — add three new tables after the `_settings` table:

Add at the end of the `bootstrapTables` function, before the closing `}`:

```typescript
  db.run(sql`${sql.raw(`CREATE TABLE IF NOT EXISTS _flows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    trigger TEXT NOT NULL,
    steps TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`)}`)

  db.run(sql`${sql.raw(`CREATE TABLE IF NOT EXISTS _flow_runs (
    id TEXT PRIMARY KEY,
    flow_id TEXT NOT NULL REFERENCES _flows(id) ON DELETE CASCADE,
    trigger_event TEXT NOT NULL,
    trigger_payload TEXT,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    error TEXT
  )`)}`)

  db.run(sql`${sql.raw(`CREATE INDEX IF NOT EXISTS idx_flow_runs_flow_id ON _flow_runs(flow_id, started_at DESC)`)}`)

  db.run(sql`${sql.raw(`CREATE TABLE IF NOT EXISTS _flow_run_steps (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES _flow_runs(id) ON DELETE CASCADE,
    step_id TEXT NOT NULL,
    status TEXT NOT NULL,
    input TEXT,
    output TEXT,
    branch_taken TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    error TEXT
  )`)}`)

  db.run(sql`${sql.raw(`CREATE INDEX IF NOT EXISTS idx_flow_run_steps_run_id ON _flow_run_steps(run_id)`)}`)
```

### Step 4: Implement the store

- [ ] **Create `packages/core/src/automations/store.ts`**

```typescript
import { sql } from "drizzle-orm"
import type { AppDatabase } from "../db/connection"
import type { Flow, FlowRun, FlowRunStep, FlowRunStatus, FlowRunStepStatus, FlowStep, FlowTrigger, CreateFlowInput } from "./types"

type RecordStepInput = {
  run_id: string
  step_id: string
  status: FlowRunStepStatus
  input?: string
  output?: string
  branch_taken?: string
  error?: string
}

export function createFlowStore(db: AppDatabase) {
  function createFlow(input: CreateFlowInput): Flow {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const triggerJson = JSON.stringify(input.trigger)
    const stepsJson = JSON.stringify(input.steps)
    const active = input.active !== false ? 1 : 0
    db.run(sql`INSERT INTO _flows (id, name, description, trigger, steps, active, created_at, updated_at) VALUES (${id}, ${input.name}, ${input.description ?? null}, ${triggerJson}, ${stepsJson}, ${active}, ${now}, ${now})`)
    return { id, name: input.name, description: input.description, active: active === 1, trigger: input.trigger, steps: input.steps, created_at: now, updated_at: now }
  }

  function listFlows(): Flow[] {
    const rows = db.all(sql`SELECT * FROM _flows ORDER BY created_at DESC`)
    return (rows as any[]).map(parseFlowRow)
  }

  function getFlowById(id: string): Flow | null {
    const rows = db.all(sql`SELECT * FROM _flows WHERE id = ${id}`)
    const row = (rows as any[])[0]
    return row ? parseFlowRow(row) : null
  }

  function updateFlow(id: string, data: Partial<CreateFlowInput>): Flow | null {
    const existing = getFlowById(id)
    if (!existing) return null
    const now = new Date().toISOString()
    const name = data.name ?? existing.name
    const description = data.description ?? existing.description
    const trigger = data.trigger ?? existing.trigger
    const steps = data.steps ?? existing.steps
    const active = data.active !== undefined ? (data.active ? 1 : 0) : (existing.active ? 1 : 0)
    db.run(sql`UPDATE _flows SET name = ${name}, description = ${description ?? null}, trigger = ${JSON.stringify(trigger)}, steps = ${JSON.stringify(steps)}, active = ${active}, updated_at = ${now} WHERE id = ${id}`)
    return getFlowById(id)
  }

  function deleteFlow(id: string): boolean {
    db.run(sql`DELETE FROM _flow_run_steps WHERE run_id IN (SELECT id FROM _flow_runs WHERE flow_id = ${id})`)
    db.run(sql`DELETE FROM _flow_runs WHERE flow_id = ${id}`)
    db.run(sql`DELETE FROM _flows WHERE id = ${id}`)
    return true
  }

  function toggleFlow(id: string): Flow | null {
    const existing = getFlowById(id)
    if (!existing) return null
    const newActive = existing.active ? 0 : 1
    db.run(sql`UPDATE _flows SET active = ${newActive}, updated_at = ${new Date().toISOString()} WHERE id = ${id}`)
    return getFlowById(id)
  }

  function getActiveFlowsByTrigger(triggerType: string): Flow[] {
    const all = listFlows()
    return all.filter(f => f.active && f.trigger.type === triggerType)
  }

  function createRun(flowId: string, triggerEvent: string, triggerPayload: string): FlowRun {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    db.run(sql`INSERT INTO _flow_runs (id, flow_id, trigger_event, trigger_payload, status, started_at) VALUES (${id}, ${flowId}, ${triggerEvent}, ${triggerPayload}, ${"running"}, ${now})`)
    return { id, flow_id: flowId, trigger_event: triggerEvent, trigger_payload: triggerPayload, status: "running", started_at: now }
  }

  function getRun(id: string): FlowRun | null {
    const rows = db.all(sql`SELECT * FROM _flow_runs WHERE id = ${id}`)
    const row = (rows as any[])[0]
    return row ? (row as FlowRun) : null
  }

  function completeRun(id: string, status: FlowRunStatus, error?: string): void {
    const now = new Date().toISOString()
    db.run(sql`UPDATE _flow_runs SET status = ${status}, finished_at = ${now}, error = ${error ?? null} WHERE id = ${id}`)
  }

  function recordStep(input: RecordStepInput): FlowRunStep {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    db.run(sql`INSERT INTO _flow_run_steps (id, run_id, step_id, status, input, output, branch_taken, started_at, finished_at, error) VALUES (${id}, ${input.run_id}, ${input.step_id}, ${input.status}, ${input.input ?? null}, ${input.output ?? null}, ${input.branch_taken ?? null}, ${now}, ${input.status !== "running" ? now : null}, ${input.error ?? null})`)
    return { id, run_id: input.run_id, step_id: input.step_id, status: input.status, input: input.input, output: input.output, branch_taken: input.branch_taken, started_at: now, finished_at: input.status !== "running" ? now : undefined, error: input.error }
  }

  function getRunSteps(runId: string): FlowRunStep[] {
    const rows = db.all(sql`SELECT * FROM _flow_run_steps WHERE run_id = ${runId} ORDER BY started_at ASC`)
    return rows as FlowRunStep[]
  }

  function listRuns(flowId: string, limit = 50, offset = 0): FlowRun[] {
    const rows = db.all(sql`SELECT * FROM _flow_runs WHERE flow_id = ${flowId} ORDER BY started_at DESC LIMIT ${limit} OFFSET ${offset}`)
    return rows as FlowRun[]
  }

  function purgeOldRuns(retentionDays: number): number {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()
    const oldRuns = db.all(sql`SELECT id FROM _flow_runs WHERE started_at < ${cutoff}`) as Array<{ id: string }>
    for (const run of oldRuns) {
      db.run(sql`DELETE FROM _flow_run_steps WHERE run_id = ${run.id}`)
    }
    db.run(sql`DELETE FROM _flow_runs WHERE started_at < ${cutoff}`)
    return oldRuns.length
  }

  return { createFlow, listFlows, getFlowById, updateFlow, deleteFlow, toggleFlow, getActiveFlowsByTrigger, createRun, getRun, completeRun, recordStep, getRunSteps, listRuns, purgeOldRuns }
}

function parseFlowRow(row: any): Flow {
  return {
    ...row,
    trigger: typeof row.trigger === "string" ? JSON.parse(row.trigger) : row.trigger,
    steps: typeof row.steps === "string" ? JSON.parse(row.steps) : row.steps,
    active: Boolean(row.active),
  }
}

export type FlowStore = ReturnType<typeof createFlowStore>
```

### Step 5: Write type validation tests

- [ ] **Create `packages/core/test/automations/types.test.ts`**

```typescript
import { test, expect, describe } from "bun:test"
import type { Flow, FlowStep, FlowTrigger, ConditionStep, ActionStep } from "../../src/automations/types"

describe("automation types", () => {
  test("a content trigger with collection compiles", () => {
    const trigger: FlowTrigger = { type: "content.published", collection: "posts" }
    expect(trigger.type).toBe("content.published")
  })

  test("a cron trigger requires cron field", () => {
    const trigger: FlowTrigger = { type: "schedule.cron", cron: "0 * * * *" }
    expect(trigger.cron).toBe("0 * * * *")
  })

  test("a condition step has branches", () => {
    const step: ConditionStep = {
      id: "s1",
      type: "condition",
      rules: [{ field: "status", operator: "eq", value: "published" }],
      match: "all",
      branches: { true: "s2", false: null },
    }
    expect(step.branches.true).toBe("s2")
  })

  test("an action step has config and next", () => {
    const step: ActionStep = {
      id: "s2",
      type: "action.webhook",
      config: { url: "https://example.com", method: "POST" },
      next: null,
    }
    expect(step.type).toBe("action.webhook")
  })

  test("FlowStep union accepts both condition and action", () => {
    const steps: FlowStep[] = [
      { id: "s1", type: "condition", rules: [], match: "all", branches: { true: "s2", false: null } },
      { id: "s2", type: "action.log", config: { message: "hello" }, next: null },
    ]
    expect(steps).toHaveLength(2)
  })
})
```

### Step 6: Run all tests to verify they pass

- [ ] **Run tests**

Run: `cd packages/core && bun test test/automations/`
Expected: All tests PASS

### Step 7: Export from core index

- [ ] **Modify `packages/core/src/index.ts`** — add after the `// Builder` section:

```typescript
// Automations
export { createFlowStore, type FlowStore } from "./automations/store"
export type {
  Flow, FlowTrigger, FlowStep, ConditionStep, ActionStep, ActionType,
  ConditionRule, ConditionOperator, FlowRun, FlowRunStep, FlowRunStatus,
  FlowRunStepStatus, CreateFlowInput, TriggerPayload,
} from "./automations/types"
```

### Step 8: Commit

- [ ] **Commit**

```bash
git add packages/core/src/automations/ packages/core/test/automations/ packages/core/src/db/bootstrap.ts packages/core/src/index.ts
git commit -m "feat(E1): automation types, flow store, and DB tables"
```

---

## Task E2: Engine (Graph Walker + Conditions + Actions)

**Files:**
- Create: `packages/core/src/automations/engine.ts`
- Create: `packages/core/test/automations/engine.test.ts`

### Step 1: Write failing engine tests

- [ ] **Create `packages/core/test/automations/engine.test.ts`**

```typescript
import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { unlinkSync } from "node:fs"
import { createDatabase } from "../../src/db/connection"
import { bootstrapTables } from "../../src/db/bootstrap"
import { createFlowStore } from "../../src/automations/store"
import { createFlowEngine, resolvePayloadPath, interpolate, evaluateCondition } from "../../src/automations/engine"
import type { FlowStep, ConditionRule, TriggerPayload } from "../../src/automations/types"

const testDbPath = "test-automations-engine.db"
let db: ReturnType<typeof createDatabase>
let store: ReturnType<typeof createFlowStore>

describe("resolvePayloadPath", () => {
  test("resolves top-level field", () => {
    expect(resolvePayloadPath({ name: "hello" }, "name")).toBe("hello")
  })

  test("resolves nested dot-path", () => {
    expect(resolvePayloadPath({ document: { title: "Hi" } }, "document.title")).toBe("Hi")
  })

  test("returns undefined for missing path", () => {
    expect(resolvePayloadPath({ a: 1 }, "b.c")).toBeUndefined()
  })

  test("strips payload. prefix", () => {
    expect(resolvePayloadPath({ document: { title: "Hi" } }, "payload.document.title")).toBe("Hi")
  })
})

describe("interpolate", () => {
  test("replaces {{field}} with payload value", () => {
    expect(interpolate("Hello {{name}}", { name: "World" })).toBe("Hello World")
  })

  test("replaces nested {{payload.document.title}}", () => {
    expect(interpolate("Title: {{payload.document.title}}", { document: { title: "Hi" } })).toBe("Title: Hi")
  })

  test("leaves unknown placeholders empty", () => {
    expect(interpolate("{{missing}}", {})).toBe("")
  })

  test("handles multiple placeholders", () => {
    expect(interpolate("{{a}} and {{b}}", { a: "X", b: "Y" })).toBe("X and Y")
  })
})

describe("evaluateCondition", () => {
  const payload = { category: "news", count: 5, title: "Hello World", active: true }

  test("eq operator", () => {
    expect(evaluateCondition({ field: "category", operator: "eq", value: "news" }, payload)).toBe(true)
    expect(evaluateCondition({ field: "category", operator: "eq", value: "blog" }, payload)).toBe(false)
  })

  test("neq operator", () => {
    expect(evaluateCondition({ field: "category", operator: "neq", value: "blog" }, payload)).toBe(true)
  })

  test("contains operator", () => {
    expect(evaluateCondition({ field: "title", operator: "contains", value: "World" }, payload)).toBe(true)
    expect(evaluateCondition({ field: "title", operator: "contains", value: "xyz" }, payload)).toBe(false)
  })

  test("not_contains operator", () => {
    expect(evaluateCondition({ field: "title", operator: "not_contains", value: "xyz" }, payload)).toBe(true)
  })

  test("gt operator", () => {
    expect(evaluateCondition({ field: "count", operator: "gt", value: 3 }, payload)).toBe(true)
    expect(evaluateCondition({ field: "count", operator: "gt", value: 10 }, payload)).toBe(false)
  })

  test("lt operator", () => {
    expect(evaluateCondition({ field: "count", operator: "lt", value: 10 }, payload)).toBe(true)
  })

  test("matches operator (regex)", () => {
    expect(evaluateCondition({ field: "title", operator: "matches", value: "^Hello" }, payload)).toBe(true)
    expect(evaluateCondition({ field: "title", operator: "matches", value: "^Bye" }, payload)).toBe(false)
  })
})

describe("flow engine", () => {
  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [])
    store = createFlowStore(db)
  })

  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("executes a single log action step", async () => {
    const flow = store.createFlow({
      name: "Test",
      trigger: { type: "content.created" },
      steps: [
        { id: "s1", type: "action.log", config: { message: "Doc created: {{document.title}}" }, next: null },
      ],
    })

    const engine = createFlowEngine(store)
    const runId = await engine.executeFlow(flow, { event: "content.created", document: { title: "Hello" } })

    const run = store.getRun(runId)
    expect(run!.status).toBe("completed")

    const steps = store.getRunSteps(runId)
    expect(steps).toHaveLength(1)
    expect(steps[0].status).toBe("completed")
    expect(JSON.parse(steps[0].output!).message).toBe("Doc created: Hello")
  })

  test("evaluates condition and takes true branch", async () => {
    const flow = store.createFlow({
      name: "Branch test",
      trigger: { type: "content.created" },
      steps: [
        { id: "s1", type: "condition", rules: [{ field: "document.category", operator: "eq", value: "news" }], match: "all", branches: { true: "s2", false: "s3" } },
        { id: "s2", type: "action.log", config: { message: "Is news" }, next: null },
        { id: "s3", type: "action.log", config: { message: "Not news" }, next: null },
      ],
    })

    const engine = createFlowEngine(store)
    const runId = await engine.executeFlow(flow, { event: "content.created", document: { category: "news" } })

    const steps = store.getRunSteps(runId)
    expect(steps).toHaveLength(2)
    expect(steps[0].branch_taken).toBe("true")
    expect(JSON.parse(steps[1].output!).message).toBe("Is news")
  })

  test("evaluates condition and takes false branch", async () => {
    const flow = store.createFlow({
      name: "Branch test",
      trigger: { type: "content.created" },
      steps: [
        { id: "s1", type: "condition", rules: [{ field: "document.category", operator: "eq", value: "news" }], match: "all", branches: { true: "s2", false: "s3" } },
        { id: "s2", type: "action.log", config: { message: "Is news" }, next: null },
        { id: "s3", type: "action.log", config: { message: "Not news" }, next: null },
      ],
    })

    const engine = createFlowEngine(store)
    const runId = await engine.executeFlow(flow, { event: "content.created", document: { category: "blog" } })

    const steps = store.getRunSteps(runId)
    expect(steps).toHaveLength(2)
    expect(steps[0].branch_taken).toBe("false")
    expect(JSON.parse(steps[1].output!).message).toBe("Not news")
  })

  test("transform action reshapes payload via mappings", async () => {
    const flow = store.createFlow({
      name: "Transform test",
      trigger: { type: "content.created" },
      steps: [
        { id: "s1", type: "action.transform", config: { mappings: { title: "document.title", slug: "document.slug" } }, next: "s2" },
        { id: "s2", type: "action.log", config: { message: "Title is {{title}}" }, next: null },
      ],
    })

    const engine = createFlowEngine(store)
    const runId = await engine.executeFlow(flow, { event: "content.created", document: { title: "Hi", slug: "hi" } })

    const steps = store.getRunSteps(runId)
    expect(steps).toHaveLength(2)
    const transformOutput = JSON.parse(steps[0].output!)
    expect(transformOutput.title).toBe("Hi")
    expect(transformOutput.slug).toBe("hi")
  })

  test("condition with match:any passes if any rule matches", async () => {
    const flow = store.createFlow({
      name: "Any test",
      trigger: { type: "content.created" },
      steps: [
        {
          id: "s1", type: "condition", match: "any",
          rules: [
            { field: "document.category", operator: "eq", value: "news" },
            { field: "document.category", operator: "eq", value: "blog" },
          ],
          branches: { true: "s2", false: null },
        },
        { id: "s2", type: "action.log", config: { message: "matched" }, next: null },
      ],
    })

    const engine = createFlowEngine(store)
    const runId = await engine.executeFlow(flow, { event: "content.created", document: { category: "blog" } })

    const steps = store.getRunSteps(runId)
    expect(steps[0].branch_taken).toBe("true")
  })

  test("failed action marks run as failed", async () => {
    const flow = store.createFlow({
      name: "Fail test",
      trigger: { type: "content.created" },
      steps: [
        { id: "s1", type: "action.webhook", config: { url: "http://localhost:99999/doesnotexist", method: "POST" }, next: null },
      ],
    })

    const engine = createFlowEngine(store)
    const runId = await engine.executeFlow(flow, { event: "content.created", document: {} })

    const run = store.getRun(runId)
    expect(run!.status).toBe("failed")
  })

  test("empty steps flow completes immediately", async () => {
    const flow = store.createFlow({
      name: "Empty",
      trigger: { type: "content.created" },
      steps: [],
    })

    const engine = createFlowEngine(store)
    const runId = await engine.executeFlow(flow, { event: "content.created" })

    const run = store.getRun(runId)
    expect(run!.status).toBe("completed")
  })
})
```

- [ ] **Run tests to verify they fail**

Run: `cd packages/core && bun test test/automations/engine.test.ts`
Expected: FAIL — `createFlowEngine` not found

### Step 2: Implement the engine

- [ ] **Create `packages/core/src/automations/engine.ts`**

```typescript
import type { FlowStore } from "./store"
import type { Flow, FlowStep, ConditionStep, ActionStep, ConditionRule, TriggerPayload } from "./types"

export function resolvePayloadPath(payload: Record<string, unknown>, path: string): unknown {
  const cleanPath = path.startsWith("payload.") ? path.slice("payload.".length) : path
  const parts = cleanPath.split(".")
  let current: unknown = payload
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function interpolate(template: string, payload: Record<string, unknown>): string {
  return template.replace(/\{\{(.+?)\}\}/g, (_match, path: string) => {
    const value = resolvePayloadPath(payload, path.trim())
    return value !== undefined && value !== null ? String(value) : ""
  })
}

export function evaluateCondition(rule: ConditionRule, payload: Record<string, unknown>): boolean {
  const actual = resolvePayloadPath(payload, rule.field)
  switch (rule.operator) {
    case "eq": return actual === rule.value
    case "neq": return actual !== rule.value
    case "contains": return typeof actual === "string" && actual.includes(String(rule.value))
    case "not_contains": return typeof actual === "string" && !actual.includes(String(rule.value))
    case "gt": return typeof actual === "number" && actual > Number(rule.value)
    case "lt": return typeof actual === "number" && actual < Number(rule.value)
    case "matches": {
      if (typeof actual !== "string") return false
      try { return new RegExp(String(rule.value)).test(actual) } catch { return false }
    }
    default: return false
  }
}

function resolveStepById(steps: FlowStep[], stepId: string): FlowStep | undefined {
  return steps.find(s => s.id === stepId)
}

function evaluateConditionStep(step: ConditionStep, payload: Record<string, unknown>): boolean {
  if (step.match === "any") {
    return step.rules.some(rule => evaluateCondition(rule, payload))
  }
  return step.rules.every(rule => evaluateCondition(rule, payload))
}

async function executeActionStep(step: ActionStep, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  switch (step.type) {
    case "action.log": {
      const message = interpolate(String(step.config.message ?? ""), payload)
      return { message }
    }

    case "action.transform": {
      const mappings = step.config.mappings as Record<string, string> | undefined
      if (!mappings) return payload
      const result: Record<string, unknown> = {}
      for (const [key, pathOrTemplate] of Object.entries(mappings)) {
        if (pathOrTemplate.includes("{{")) {
          result[key] = interpolate(pathOrTemplate, payload)
        } else if (pathOrTemplate.startsWith('"') && pathOrTemplate.endsWith('"')) {
          result[key] = pathOrTemplate.slice(1, -1)
        } else {
          result[key] = resolvePayloadPath(payload, pathOrTemplate)
        }
      }
      return result
    }

    case "action.webhook": {
      const url = interpolate(String(step.config.url ?? ""), payload)
      const method = String(step.config.method ?? "POST")
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (step.config.headers && typeof step.config.headers === "object") {
        for (const [k, v] of Object.entries(step.config.headers as Record<string, string>)) {
          headers[k] = interpolate(v, payload)
        }
      }
      const body = JSON.stringify(payload)
      const retryDelays = [1000, 5000, 15000]
      let lastError: Error | null = null
      for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
        try {
          const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(10000) })
          const responseBody = await res.text().catch(() => "")
          if (!res.ok) {
            lastError = new Error(`Webhook failed: ${res.status} ${responseBody}`)
            if (attempt < retryDelays.length) {
              await new Promise(r => setTimeout(r, retryDelays[attempt]))
              continue
            }
            throw lastError
          }
          try { return JSON.parse(responseBody) } catch { return { response: responseBody, status: res.status } }
        } catch (err: any) {
          lastError = err
          if (attempt < retryDelays.length) {
            await new Promise(r => setTimeout(r, retryDelays[attempt]))
            continue
          }
          throw lastError
        }
      }
      throw lastError ?? new Error("Webhook failed after retries")
    }

    case "action.email": {
      const to = interpolate(String(step.config.to ?? ""), payload)
      const subject = interpolate(String(step.config.subject ?? ""), payload)
      return { sent: true, to, subject }
    }

    case "action.create_content": {
      const collection = String(step.config.collection ?? "")
      const dataTemplate = step.config.data as Record<string, string> | undefined
      const data: Record<string, unknown> = {}
      if (dataTemplate) {
        for (const [k, v] of Object.entries(dataTemplate)) {
          data[k] = v.includes("{{") ? interpolate(v, payload) : resolvePayloadPath(payload, v) ?? v
        }
      }
      return { action: "create_content", collection, data }
    }

    case "action.update_content": {
      const collection = String(step.config.collection ?? "")
      const documentId = interpolate(String(step.config.documentId ?? ""), payload)
      const dataTemplate = step.config.data as Record<string, string> | undefined
      const data: Record<string, unknown> = {}
      if (dataTemplate) {
        for (const [k, v] of Object.entries(dataTemplate)) {
          data[k] = v.includes("{{") ? interpolate(v, payload) : resolvePayloadPath(payload, v) ?? v
        }
      }
      return { action: "update_content", collection, documentId, data }
    }

    case "action.delete_content": {
      const collection = String(step.config.collection ?? "")
      const documentId = interpolate(String(step.config.documentId ?? ""), payload)
      return { action: "delete_content", collection, documentId }
    }

    default:
      return payload
  }
}

export function createFlowEngine(store: FlowStore) {
  async function executeFlow(flow: Flow, triggerPayload: Record<string, unknown>): Promise<string> {
    const run = store.createRun(flow.id, flow.trigger.type, JSON.stringify(triggerPayload))

    if (flow.steps.length === 0) {
      store.completeRun(run.id, "completed")
      return run.id
    }

    let currentStep: FlowStep | undefined = flow.steps[0]
    let currentPayload = triggerPayload

    try {
      while (currentStep) {
        const stepInput = JSON.stringify(currentPayload)

        if (currentStep.type === "condition") {
          const result = evaluateConditionStep(currentStep, currentPayload)
          const branchTaken = result ? "true" : "false"
          store.recordStep({
            run_id: run.id,
            step_id: currentStep.id,
            status: "completed",
            input: stepInput,
            output: stepInput,
            branch_taken: branchTaken,
          })
          const nextId = result ? currentStep.branches.true : currentStep.branches.false
          currentStep = nextId ? resolveStepById(flow.steps, nextId) : undefined
        } else {
          try {
            const output = await executeActionStep(currentStep, currentPayload)
            store.recordStep({
              run_id: run.id,
              step_id: currentStep.id,
              status: "completed",
              input: stepInput,
              output: JSON.stringify(output),
            })
            currentPayload = output
            currentStep = currentStep.next ? resolveStepById(flow.steps, currentStep.next) : undefined
          } catch (err: any) {
            store.recordStep({
              run_id: run.id,
              step_id: currentStep.id,
              status: "failed",
              input: stepInput,
              error: err.message,
            })
            store.completeRun(run.id, "failed", err.message)
            return run.id
          }
        }
      }

      store.completeRun(run.id, "completed")
    } catch (err: any) {
      store.completeRun(run.id, "failed", err.message)
    }

    return run.id
  }

  return { executeFlow }
}

export type FlowEngine = ReturnType<typeof createFlowEngine>
```

### Step 3: Run tests to verify they pass

- [ ] **Run tests**

Run: `cd packages/core && bun test test/automations/engine.test.ts`
Expected: All tests PASS

### Step 4: Export engine from core index

- [ ] **Modify `packages/core/src/index.ts`** — add to the Automations section:

```typescript
export { createFlowEngine, resolvePayloadPath, interpolate, evaluateCondition, type FlowEngine } from "./automations/engine"
```

### Step 5: Commit

- [ ] **Commit**

```bash
git add packages/core/src/automations/engine.ts packages/core/test/automations/engine.test.ts packages/core/src/index.ts
git commit -m "feat(E2): automation engine with graph walker, conditions, and actions"
```

---

## Task E3: Content Service Integration + Cron + REST API

**Files:**
- Create: `packages/core/src/automations/cron.ts`
- Create: `packages/core/test/automations/cron.test.ts`
- Modify: `packages/core/src/content/service.ts`
- Modify: `packages/core/test/content/service.test.ts`
- Create: `packages/server/src/automations/handler.ts`
- Create: `packages/server/test/automations/handler.test.ts`
- Modify: `packages/server/src/index.ts`

### Step 1: Write cron matcher tests

- [ ] **Create `packages/core/test/automations/cron.test.ts`**

```typescript
import { test, expect, describe } from "bun:test"
import { matchesCron } from "../../src/automations/cron"

describe("matchesCron", () => {
  test("* * * * * matches any time", () => {
    expect(matchesCron("* * * * *", new Date("2026-04-07T10:30:00Z"))).toBe(true)
  })

  test("30 * * * * matches at minute 30", () => {
    expect(matchesCron("30 * * * *", new Date("2026-04-07T10:30:00Z"))).toBe(true)
    expect(matchesCron("30 * * * *", new Date("2026-04-07T10:15:00Z"))).toBe(false)
  })

  test("0 10 * * * matches at hour 10 minute 0", () => {
    expect(matchesCron("0 10 * * *", new Date("2026-04-07T10:00:00Z"))).toBe(true)
    expect(matchesCron("0 10 * * *", new Date("2026-04-07T11:00:00Z"))).toBe(false)
  })

  test("0 0 1 * * matches first day of month", () => {
    expect(matchesCron("0 0 1 * *", new Date("2026-04-01T00:00:00Z"))).toBe(true)
    expect(matchesCron("0 0 1 * *", new Date("2026-04-02T00:00:00Z"))).toBe(false)
  })

  test("*/15 * * * * matches every 15 minutes", () => {
    expect(matchesCron("*/15 * * * *", new Date("2026-04-07T10:00:00Z"))).toBe(true)
    expect(matchesCron("*/15 * * * *", new Date("2026-04-07T10:15:00Z"))).toBe(true)
    expect(matchesCron("*/15 * * * *", new Date("2026-04-07T10:07:00Z"))).toBe(false)
  })

  test("comma-separated values", () => {
    expect(matchesCron("0,30 * * * *", new Date("2026-04-07T10:00:00Z"))).toBe(true)
    expect(matchesCron("0,30 * * * *", new Date("2026-04-07T10:30:00Z"))).toBe(true)
    expect(matchesCron("0,30 * * * *", new Date("2026-04-07T10:15:00Z"))).toBe(false)
  })
})
```

- [ ] **Run to verify failure**

Run: `cd packages/core && bun test test/automations/cron.test.ts`
Expected: FAIL

### Step 2: Implement cron matcher

- [ ] **Create `packages/core/src/automations/cron.ts`**

```typescript
import type { FlowStore } from "./store"
import type { FlowEngine } from "./engine"

function matchField(pattern: string, value: number): boolean {
  if (pattern === "*") return true

  // Handle */N (every N)
  if (pattern.startsWith("*/")) {
    const divisor = parseInt(pattern.slice(2), 10)
    return value % divisor === 0
  }

  // Handle comma-separated values
  if (pattern.includes(",")) {
    return pattern.split(",").some(p => matchField(p.trim(), value))
  }

  // Handle range N-M
  if (pattern.includes("-")) {
    const [min, max] = pattern.split("-").map(Number)
    return value >= min && value <= max
  }

  // Exact match
  return parseInt(pattern, 10) === value
}

export function matchesCron(expression: string, now: Date): boolean {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) return false

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts
  return (
    matchField(minute, now.getUTCMinutes()) &&
    matchField(hour, now.getUTCHours()) &&
    matchField(dayOfMonth, now.getUTCDate()) &&
    matchField(month, now.getUTCMonth() + 1) &&
    matchField(dayOfWeek, now.getUTCDay())
  )
}

export function createAutomationCron(store: FlowStore, engine: FlowEngine) {
  async function tick(): Promise<number> {
    const now = new Date()
    const cronFlows = store.getActiveFlowsByTrigger("schedule.cron")
    let triggered = 0

    for (const flow of cronFlows) {
      if (flow.trigger.type === "schedule.cron" && matchesCron(flow.trigger.cron, now)) {
        engine.executeFlow(flow, { event: "schedule.cron", timestamp: now.toISOString() }).catch(() => {})
        triggered++
      }
    }

    // Purge old runs
    store.purgeOldRuns(30)

    return triggered
  }

  return { tick }
}

export type AutomationCron = ReturnType<typeof createAutomationCron>
```

### Step 3: Run cron tests

- [ ] **Run tests**

Run: `cd packages/core && bun test test/automations/cron.test.ts`
Expected: All PASS

### Step 4: Add automation dispatch to content service

- [ ] **Modify `packages/core/src/content/service.ts`** — change the function signature to accept an `automations` parameter:

Replace the function signature (lines 16-21):

```typescript
export function createContentService(
  db: AppDatabase,
  collection: CollectionDef,
  table: AnyTable,
  versioning?: { createVersion: (collection: string, docId: string, data: Record<string, unknown>, action: "save" | "publish") => unknown },
  search?: { index: (collection: string, docId: string, title: string, bodyText: string) => void; remove: (collection: string, docId: string) => void },
  automations?: { dispatch: (event: string, collection: string, doc: Record<string, unknown>) => void },
) {
```

In the `create()` function, after `search.index(...)` block (after line 45), add:

```typescript
    automations?.dispatch("content.created", collection.name, saved)
```

In the `update()` function, after `search.index(...)` block (after line 113), add:

```typescript
    const wasPublished = existing.status === "published"
    const isNowPublished = updated.status === "published"
    if (!wasPublished && isNowPublished) {
      automations?.dispatch("content.published", collection.name, updated)
    } else {
      automations?.dispatch("content.updated", collection.name, updated)
    }
```

In the `remove()` function, after `runHook("afterDelete", ...)` (after line 127), add:

```typescript
    automations?.dispatch("content.deleted", collection.name, existing)
```

### Step 5: Add content service dispatch test

- [ ] **Modify `packages/core/test/content/service.test.ts`** — add a test at the end of the describe block:

```typescript
  test("automation dispatch fires on create", async () => {
    const dispatched: Array<{ event: string; collection: string }> = []
    const tableWithAuto = generateTable(page)
    const serviceWithAuto = createContentService(db, page, tableWithAuto, undefined, undefined, {
      dispatch: (event, collection) => { dispatched.push({ event, collection }) },
    })
    await serviceWithAuto.create({ title: "Auto Test" })
    expect(dispatched).toHaveLength(1)
    expect(dispatched[0].event).toBe("content.created")
  })

  test("automation dispatch fires content.published on status transition", async () => {
    const dispatched: Array<{ event: string }> = []
    const tableWithAuto = generateTable(page)
    const serviceWithAuto = createContentService(db, page, tableWithAuto, undefined, undefined, {
      dispatch: (event) => { dispatched.push({ event }) },
    })
    const doc = await serviceWithAuto.create({ title: "Draft", status: "draft" })
    dispatched.length = 0
    await serviceWithAuto.update(doc.id as string, { status: "published" })
    expect(dispatched.some(d => d.event === "content.published")).toBe(true)
  })
```

### Step 6: Run content service tests

- [ ] **Run tests**

Run: `cd packages/core && bun test test/content/service.test.ts`
Expected: All PASS

### Step 7: Create the REST handler for flows

- [ ] **Create `packages/server/src/automations/handler.ts`**

```typescript
import type { FlowStore } from "@not-a-cms/core"
import type { FlowEngine } from "@not-a-cms/core"

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export function createAutomationHandler(store: FlowStore, engine: FlowEngine) {
  return async function handler(req: Request): Promise<Response | null> {
    const url = new URL(req.url)
    const pathname = url.pathname
    const method = req.method.toUpperCase()

    if (!pathname.startsWith("/api/_flows")) return null

    const segments = pathname.slice("/api/_flows".length).split("/").filter(Boolean)

    // POST /api/_flows/:id/trigger — public inbound webhook
    if (segments.length === 2 && segments[1] === "trigger" && method === "POST") {
      const flowId = segments[0]
      const flow = store.getFlowById(flowId)
      if (!flow) return json({ error: "Flow not found" }, 404)
      if (!flow.active) return json({ error: "Flow is inactive" }, 400)
      if (flow.trigger.type !== "webhook.received") return json({ error: "Flow does not accept inbound webhooks" }, 400)

      const body = await req.json().catch(() => ({}))
      const headers: Record<string, string> = {}
      req.headers.forEach((v, k) => { headers[k] = v })

      engine.executeFlow(flow, { event: "webhook.received", body, headers }).catch(() => {})
      return json({ triggered: true, flow_id: flowId })
    }

    // GET /api/_flows/:id/runs/:runId — run detail with steps
    if (segments.length === 3 && segments[1] === "runs" && method === "GET") {
      const flowId = segments[0]
      const runId = segments[2]
      const run = store.getRun(runId)
      if (!run || run.flow_id !== flowId) return json({ error: "Run not found" }, 404)
      const steps = store.getRunSteps(runId)
      return json({ ...run, steps })
    }

    // GET /api/_flows/:id/runs — list runs
    if (segments.length === 2 && segments[1] === "runs" && method === "GET") {
      const flowId = segments[0]
      const limit = Number(url.searchParams.get("limit") ?? 50)
      const offset = Number(url.searchParams.get("offset") ?? 0)
      const runs = store.listRuns(flowId, limit, offset)
      return json({ data: runs })
    }

    // DELETE /api/_flows/:id/runs — purge runs
    if (segments.length === 2 && segments[1] === "runs" && method === "DELETE") {
      const flowId = segments[0]
      const purged = store.purgeOldRuns(0)
      return json({ purged })
    }

    // POST /api/_flows/:id/toggle
    if (segments.length === 2 && segments[1] === "toggle" && method === "POST") {
      const flowId = segments[0]
      const toggled = store.toggleFlow(flowId)
      if (!toggled) return json({ error: "Flow not found" }, 404)
      return json(toggled)
    }

    // GET /api/_flows — list all flows
    if (segments.length === 0 && method === "GET") {
      return json({ data: store.listFlows() })
    }

    // POST /api/_flows — create flow
    if (segments.length === 0 && method === "POST") {
      const body = await req.json()
      const flow = store.createFlow(body)
      return json(flow, 201)
    }

    // GET /api/_flows/:id
    if (segments.length === 1 && method === "GET") {
      const flow = store.getFlowById(segments[0])
      if (!flow) return json({ error: "Flow not found" }, 404)
      return json(flow)
    }

    // PATCH /api/_flows/:id
    if (segments.length === 1 && method === "PATCH") {
      const body = await req.json()
      const updated = store.updateFlow(segments[0], body)
      if (!updated) return json({ error: "Flow not found" }, 404)
      return json(updated)
    }

    // DELETE /api/_flows/:id
    if (segments.length === 1 && method === "DELETE") {
      store.deleteFlow(segments[0])
      return json({ deleted: true })
    }

    return json({ error: "Method not allowed" }, 405)
  }
}
```

### Step 8: Wire automations into the server

- [ ] **Modify `packages/server/src/index.ts`**

Add imports at the top:

```typescript
import { createFlowStore, createFlowEngine, createAutomationCron } from "@not-a-cms/core"
import { createAutomationHandler } from "./automations/handler"
```

After `const webhookService = createWebhookService(webhookStore)` (around line 62), add:

```typescript
  const flowStore = createFlowStore(db)
  const flowEngine = createFlowEngine(flowStore)
  const automationHandler = createAutomationHandler(flowStore, flowEngine)
  const automationCron = createAutomationCron(flowStore, flowEngine)
```

In the collection creation loop, change `createContentService` to pass the dispatcher:

```typescript
    const service = createContentService(db, def, table, versioning, search, {
      dispatch: (event, collection, doc) => {
        const matchingFlows = flowStore.getActiveFlowsByTrigger(event)
        for (const flow of matchingFlows) {
          const trigger = flow.trigger as { type: string; collection?: string }
          if (trigger.collection && trigger.collection !== collection) continue
          flowEngine.executeFlow(flow, { event, collection, document: doc }).catch(() => {})
        }
      },
    })
```

In the `fetch` handler, before the `// REST routes` section, add:

```typescript
      // Automation routes
      if (url.pathname.startsWith("/api/_flows")) {
        const res = await automationHandler(req)
        if (res) return res
      }
```

In the existing `setInterval` block, add the cron tick alongside the scheduler:

```typescript
  setInterval(async () => {
    try {
      const promoted = await scheduler.promoteScheduled()
      if (promoted.length > 0 && !process.env.QUIET) {
        console.log(`  Scheduled publishing: promoted ${promoted.length} post(s)`)
      }
    } catch {}
    try {
      await automationCron.tick()
    } catch {}
  }, 60_000)
```

Update the return statement to include new services:

```typescript
  return { server, db, collections, versioning, search, trpcRouter, webhookStore, webhookService, previewTokenService, settingsService, componentRegistry, flowStore, flowEngine }
```

### Step 9: Export cron from core index

- [ ] **Modify `packages/core/src/index.ts`** — add to Automations section:

```typescript
export { matchesCron, createAutomationCron, type AutomationCron } from "./automations/cron"
```

### Step 10: Run all core tests

- [ ] **Run all core tests**

Run: `cd packages/core && bun test`
Expected: All PASS

### Step 11: Commit

- [ ] **Commit**

```bash
git add packages/core/src/automations/cron.ts packages/core/test/automations/cron.test.ts packages/core/src/content/service.ts packages/core/test/content/service.test.ts packages/server/src/automations/handler.ts packages/server/src/index.ts packages/core/src/index.ts
git commit -m "feat(E3): content service dispatch, cron matcher, and automation REST API"
```

---

## Task E4: Admin UI — Flow List + Flow Editor + Canvas

**Files:**
- Create: `packages/admin/src/components/automations/FlowList.tsx`
- Create: `packages/admin/src/components/automations/FlowEditor.tsx`
- Create: `packages/admin/src/components/automations/FlowCanvas.tsx`
- Create: `packages/admin/src/components/automations/StepPicker.tsx`
- Create: `packages/admin/src/pages/automations/index.astro`
- Create: `packages/admin/src/pages/automations/[id].astro`
- Modify: `packages/admin/src/components/Sidebar.astro`

### Step 1: Create the flow list page

- [ ] **Create `packages/admin/src/pages/automations/index.astro`**

```astro
---
import AdminLayout from "../../layouts/AdminLayout.astro"
import { FlowList } from "../../components/automations/FlowList"
---
<AdminLayout title="Automations">
  <p class="text-sm text-gray-500 mb-6">Create event-driven workflows to automate content operations.</p>
  <FlowList client:load />
</AdminLayout>
```

### Step 2: Create the FlowList component

- [ ] **Create `packages/admin/src/components/automations/FlowList.tsx`**

```tsx
import { useState, useEffect } from "react"

type Flow = {
  id: string
  name: string
  trigger: { type: string; collection?: string; cron?: string }
  active: boolean
  created_at: string
}

type FlowRun = {
  status: string
  started_at: string
}

type Props = { apiBase?: string }

const triggerLabels: Record<string, string> = {
  "content.created": "Content Created",
  "content.updated": "Content Updated",
  "content.published": "Content Published",
  "content.deleted": "Content Deleted",
  "webhook.received": "Inbound Webhook",
  "schedule.cron": "Scheduled",
}

export function FlowList({ apiBase = "" }: Props) {
  const [flows, setFlows] = useState<Flow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchFlows() }, [])

  const fetchFlows = async () => {
    try {
      const res = await fetch(`${apiBase}/api/_flows`)
      if (res.ok) {
        const data = await res.json()
        setFlows(data.data || [])
      }
    } catch {} finally { setLoading(false) }
  }

  const handleCreate = async () => {
    const res = await fetch(`${apiBase}/api/_flows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Flow", trigger: { type: "content.created" }, steps: [] }),
    })
    if (res.ok) {
      const flow = await res.json()
      window.location.href = `/automations/${flow.id}`
    }
  }

  const handleToggle = async (flow: Flow) => {
    await fetch(`${apiBase}/api/_flows/${flow.id}/toggle`, { method: "POST" })
    fetchFlows()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this flow and all its run history?")) return
    await fetch(`${apiBase}/api/_flows/${id}`, { method: "DELETE" })
    fetchFlows()
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading flows...</p>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Flows</h2>
        <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + New Flow
        </button>
      </div>

      {flows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          No automation flows yet. Create one to get started.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {flows.map((flow) => (
            <div key={flow.id} className="p-4 flex items-center justify-between">
              <div>
                <a href={`/automations/${flow.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                  {flow.name}
                </a>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {triggerLabels[flow.trigger.type] ?? flow.trigger.type}
                  </span>
                  {flow.trigger.collection && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{flow.trigger.collection}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => handleToggle(flow)} className={`text-xs px-2 py-1 rounded-full ${flow.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {flow.active ? "Active" : "Inactive"}
                </button>
                <button onClick={() => handleDelete(flow.id)} className="text-xs text-red-600 hover:text-red-800">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

### Step 3: Create the StepPicker component

- [ ] **Create `packages/admin/src/components/automations/StepPicker.tsx`**

```tsx
import { useState } from "react"

type StepType = "condition" | "action.webhook" | "action.email" | "action.create_content" | "action.update_content" | "action.delete_content" | "action.log" | "action.transform"

type Props = {
  onSelect: (type: StepType) => void
  onCancel: () => void
}

const stepOptions: Array<{ type: StepType; label: string; description: string; category: "condition" | "action" }> = [
  { type: "condition", label: "Condition", description: "Branch based on field values", category: "condition" },
  { type: "action.webhook", label: "Send Webhook", description: "Make an outbound HTTP request", category: "action" },
  { type: "action.email", label: "Send Email", description: "Send an email via MJML template", category: "action" },
  { type: "action.create_content", label: "Create Content", description: "Create a document in a collection", category: "action" },
  { type: "action.update_content", label: "Update Content", description: "Update an existing document", category: "action" },
  { type: "action.delete_content", label: "Delete Content", description: "Delete a document", category: "action" },
  { type: "action.log", label: "Log Message", description: "Record a message in execution log", category: "action" },
  { type: "action.transform", label: "Transform Data", description: "Reshape the payload with field mappings", category: "action" },
]

export function StepPicker({ onSelect, onCancel }: Props) {
  return (
    <div className="absolute z-10 mt-2 w-72 bg-white rounded-xl border border-gray-200 shadow-lg p-3 space-y-3">
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Logic</p>
        {stepOptions.filter(s => s.category === "condition").map(opt => (
          <button key={opt.type} onClick={() => onSelect(opt.type)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            <p className="text-sm font-medium text-gray-900">{opt.label}</p>
            <p className="text-xs text-gray-500">{opt.description}</p>
          </button>
        ))}
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Actions</p>
        {stepOptions.filter(s => s.category === "action").map(opt => (
          <button key={opt.type} onClick={() => onSelect(opt.type)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            <p className="text-sm font-medium text-gray-900">{opt.label}</p>
            <p className="text-xs text-gray-500">{opt.description}</p>
          </button>
        ))}
      </div>
      <button onClick={onCancel} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 py-1">Cancel</button>
    </div>
  )
}
```

### Step 4: Create the FlowCanvas component

- [ ] **Create `packages/admin/src/components/automations/FlowCanvas.tsx`**

```tsx
import { useState } from "react"
import { StepPicker } from "./StepPicker"
import type { FlowStep, FlowTrigger, ConditionStep, ActionStep } from "./flow-types"

type Props = {
  trigger: FlowTrigger
  steps: FlowStep[]
  selectedStepId: string | null
  onSelectStep: (id: string | null) => void
  onSelectTrigger: () => void
  onAddStep: (afterIndex: number, step: FlowStep) => void
  onRemoveStep: (id: string) => void
  readOnly?: boolean
  runSteps?: Array<{ step_id: string; status: string; branch_taken?: string }>
}

const triggerLabels: Record<string, string> = {
  "content.created": "Content Created",
  "content.updated": "Content Updated",
  "content.published": "Content Published",
  "content.deleted": "Content Deleted",
  "webhook.received": "Inbound Webhook",
  "schedule.cron": "Scheduled (Cron)",
}

const stepLabels: Record<string, string> = {
  "condition": "Condition",
  "action.webhook": "Send Webhook",
  "action.email": "Send Email",
  "action.create_content": "Create Content",
  "action.update_content": "Update Content",
  "action.delete_content": "Delete Content",
  "action.log": "Log",
  "action.transform": "Transform",
}

function getRunStepStatus(stepId: string, runSteps?: Props["runSteps"]): string | null {
  if (!runSteps) return null
  const found = runSteps.find(rs => rs.step_id === stepId)
  return found?.status ?? null
}

function statusColor(status: string | null): string {
  if (status === "completed") return "border-green-400 bg-green-50"
  if (status === "failed") return "border-red-400 bg-red-50"
  if (status === "skipped") return "border-gray-300 bg-gray-50"
  return ""
}

function createNewStep(type: string): FlowStep {
  const id = crypto.randomUUID()
  if (type === "condition") {
    return { id, type: "condition", rules: [{ field: "", operator: "eq", value: "" }], match: "all", branches: { true: null, false: null } } as ConditionStep
  }
  return { id, type: type as ActionStep["type"], config: {}, next: null, label: stepLabels[type] } as ActionStep
}

export function FlowCanvas({ trigger, steps, selectedStepId, onSelectStep, onSelectTrigger, onAddStep, onRemoveStep, readOnly, runSteps }: Props) {
  const [pickerAfterIndex, setPickerAfterIndex] = useState<number | null>(null)

  const handlePickStep = (type: string) => {
    if (pickerAfterIndex === null) return
    const step = createNewStep(type)
    onAddStep(pickerAfterIndex, step)
    setPickerAfterIndex(null)
    onSelectStep(step.id)
  }

  return (
    <div className="flex flex-col items-center gap-0 py-6">
      {/* Trigger block */}
      <button
        onClick={readOnly ? undefined : onSelectTrigger}
        className={`w-64 px-4 py-3 rounded-xl border-2 border-blue-300 bg-blue-50 text-sm font-medium text-blue-800 text-center ${readOnly ? "cursor-default" : "cursor-pointer hover:border-blue-400"}`}
      >
        {triggerLabels[trigger.type] ?? trigger.type}
        {trigger.type !== "webhook.received" && trigger.type !== "schedule.cron" && (trigger as any).collection && (
          <span className="block text-xs text-blue-500 mt-0.5">{(trigger as any).collection}</span>
        )}
        {trigger.type === "schedule.cron" && (
          <span className="block text-xs text-blue-500 mt-0.5">{(trigger as any).cron}</span>
        )}
      </button>

      {/* Connector + add button */}
      {!readOnly && (
        <div className="relative flex flex-col items-center">
          <div className="w-px h-6 bg-gray-300" />
          <button
            onClick={() => setPickerAfterIndex(0)}
            className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 text-gray-400 text-xs flex items-center justify-center hover:border-blue-400 hover:text-blue-400"
          >+</button>
          {pickerAfterIndex === 0 && <StepPicker onSelect={handlePickStep} onCancel={() => setPickerAfterIndex(null)} />}
          <div className="w-px h-6 bg-gray-300" />
        </div>
      )}
      {readOnly && <div className="w-px h-8 bg-gray-300" />}

      {/* Steps */}
      {steps.map((step, index) => {
        const runStatus = getRunStepStatus(step.id, runSteps)
        const isSelected = selectedStepId === step.id

        return (
          <div key={step.id} className="flex flex-col items-center">
            <button
              onClick={() => onSelectStep(step.id)}
              className={`w-64 px-4 py-3 rounded-xl border-2 text-sm text-center transition-colors ${
                isSelected ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200" :
                runStatus ? statusColor(runStatus) :
                step.type === "condition" ? "border-amber-300 bg-amber-50" :
                "border-gray-200 bg-white"
              } ${readOnly ? "cursor-default" : "cursor-pointer hover:border-gray-300"}`}
            >
              <span className="font-medium text-gray-900">{step.label || stepLabels[step.type] || step.type}</span>
              {step.type === "condition" && (
                <span className="block text-xs text-amber-600 mt-0.5">
                  {(step as ConditionStep).rules.length} rule{(step as ConditionStep).rules.length !== 1 ? "s" : ""} ({(step as ConditionStep).match})
                </span>
              )}
              {runStatus && (
                <span className={`block text-xs mt-0.5 ${runStatus === "completed" ? "text-green-600" : runStatus === "failed" ? "text-red-600" : "text-gray-400"}`}>
                  {runStatus}
                  {runSteps?.find(rs => rs.step_id === step.id)?.branch_taken && ` → ${runSteps?.find(rs => rs.step_id === step.id)?.branch_taken}`}
                </span>
              )}
            </button>

            {!readOnly && (
              <button onClick={() => onRemoveStep(step.id)} className="text-xs text-red-400 hover:text-red-600 mt-1">remove</button>
            )}

            {/* Connector + add button after this step */}
            {!readOnly && index < steps.length - 1 && (
              <div className="relative flex flex-col items-center">
                <div className="w-px h-4 bg-gray-300" />
                <button
                  onClick={() => setPickerAfterIndex(index + 1)}
                  className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 text-gray-400 text-xs flex items-center justify-center hover:border-blue-400 hover:text-blue-400"
                >+</button>
                {pickerAfterIndex === index + 1 && <StepPicker onSelect={handlePickStep} onCancel={() => setPickerAfterIndex(null)} />}
                <div className="w-px h-4 bg-gray-300" />
              </div>
            )}
            {!readOnly && index === steps.length - 1 && (
              <div className="relative flex flex-col items-center">
                <div className="w-px h-4 bg-gray-300" />
                <button
                  onClick={() => setPickerAfterIndex(index + 1)}
                  className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 text-gray-400 text-xs flex items-center justify-center hover:border-blue-400 hover:text-blue-400"
                >+</button>
                {pickerAfterIndex === index + 1 && <StepPicker onSelect={handlePickStep} onCancel={() => setPickerAfterIndex(null)} />}
              </div>
            )}
            {readOnly && index < steps.length - 1 && <div className="w-px h-8 bg-gray-300" />}
          </div>
        )
      })}
    </div>
  )
}
```

### Step 5: Create shared flow types for admin

- [ ] **Create `packages/admin/src/components/automations/flow-types.ts`**

```typescript
export type FlowTrigger =
  | { type: "content.created"; collection?: string }
  | { type: "content.updated"; collection?: string }
  | { type: "content.published"; collection?: string }
  | { type: "content.deleted"; collection?: string }
  | { type: "webhook.received" }
  | { type: "schedule.cron"; cron: string }

export type ConditionOperator = "eq" | "neq" | "contains" | "not_contains" | "matches" | "gt" | "lt"

export type ConditionRule = {
  field: string
  operator: ConditionOperator
  value: string | number | boolean
}

export type ConditionStep = {
  id: string
  type: "condition"
  label?: string
  rules: ConditionRule[]
  match: "all" | "any"
  branches: { true: string | null; false: string | null }
}

export type ActionStep = {
  id: string
  type: "action.webhook" | "action.email" | "action.create_content" | "action.update_content" | "action.delete_content" | "action.log" | "action.transform"
  label?: string
  config: Record<string, unknown>
  next: string | null
}

export type FlowStep = ConditionStep | ActionStep

export type Flow = {
  id: string
  name: string
  description?: string
  active: boolean
  trigger: FlowTrigger
  steps: FlowStep[]
  created_at: string
  updated_at: string
}

export type FlowRun = {
  id: string
  flow_id: string
  trigger_event: string
  trigger_payload?: string
  status: string
  started_at: string
  finished_at?: string
  error?: string
  steps?: FlowRunStep[]
}

export type FlowRunStep = {
  id: string
  run_id: string
  step_id: string
  status: string
  input?: string
  output?: string
  branch_taken?: string
  started_at: string
  finished_at?: string
  error?: string
}
```

### Step 6: Create the FlowEditor component

- [ ] **Create `packages/admin/src/components/automations/FlowEditor.tsx`**

```tsx
import { useState, useEffect } from "react"
import { FlowCanvas } from "./FlowCanvas"
import { StepConfigurator } from "./StepConfigurator"
import { RunList } from "./RunList"
import type { Flow, FlowStep, FlowTrigger, ConditionStep, ActionStep } from "./flow-types"

type Props = {
  flowId: string
  apiBase?: string
}

export function FlowEditor({ flowId, apiBase = "" }: Props) {
  const [flow, setFlow] = useState<Flow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [showTriggerConfig, setShowTriggerConfig] = useState(false)
  const [tab, setTab] = useState<"editor" | "runs">("editor")

  useEffect(() => { fetchFlow() }, [flowId])

  const fetchFlow = async () => {
    try {
      const res = await fetch(`${apiBase}/api/_flows/${flowId}`)
      if (res.ok) setFlow(await res.json())
    } catch {} finally { setLoading(false) }
  }

  const saveFlow = async () => {
    if (!flow) return
    setSaving(true)
    try {
      const res = await fetch(`${apiBase}/api/_flows/${flowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: flow.name, description: flow.description, trigger: flow.trigger, steps: flow.steps }),
      })
      if (res.ok) setFlow(await res.json())
    } finally { setSaving(false) }
  }

  const handleToggle = async () => {
    const res = await fetch(`${apiBase}/api/_flows/${flowId}/toggle`, { method: "POST" })
    if (res.ok) setFlow(await res.json())
  }

  const handleAddStep = (afterIndex: number, step: FlowStep) => {
    if (!flow) return
    const newSteps = [...flow.steps]
    newSteps.splice(afterIndex, 0, step)
    setFlow({ ...flow, steps: newSteps })
  }

  const handleRemoveStep = (id: string) => {
    if (!flow) return
    setFlow({ ...flow, steps: flow.steps.filter(s => s.id !== id) })
    if (selectedStepId === id) setSelectedStepId(null)
  }

  const handleUpdateStep = (id: string, updates: Partial<FlowStep>) => {
    if (!flow) return
    setFlow({
      ...flow,
      steps: flow.steps.map(s => s.id === id ? { ...s, ...updates } as FlowStep : s),
    })
  }

  const handleUpdateTrigger = (trigger: FlowTrigger) => {
    if (!flow) return
    setFlow({ ...flow, trigger })
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading flow...</p>
  if (!flow) return <p className="text-red-500 text-sm">Flow not found.</p>

  const selectedStep = flow.steps.find(s => s.id === selectedStepId) ?? null

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <input
            value={flow.name}
            onChange={(e) => setFlow({ ...flow, name: e.target.value })}
            className="text-lg font-semibold text-gray-900 border-none outline-none bg-transparent"
          />
          <button onClick={handleToggle} className={`text-xs px-3 py-1 rounded-full ${flow.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {flow.active ? "Active" : "Inactive"}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setTab("editor")} className={`px-3 py-1 text-xs rounded-md ${tab === "editor" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>Editor</button>
            <button onClick={() => setTab("runs")} className={`px-3 py-1 text-xs rounded-md ${tab === "runs" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>Runs</button>
          </div>
          <button onClick={saveFlow} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {tab === "runs" ? (
        <RunList flowId={flowId} apiBase={apiBase} steps={flow.steps} />
      ) : (
        <div className="flex gap-6">
          {/* Left: Canvas */}
          <div className="flex-1 bg-white rounded-xl border border-gray-200 min-h-[500px] overflow-auto">
            <FlowCanvas
              trigger={flow.trigger}
              steps={flow.steps}
              selectedStepId={selectedStepId}
              onSelectStep={setSelectedStepId}
              onSelectTrigger={() => { setSelectedStepId(null); setShowTriggerConfig(true) }}
              onAddStep={handleAddStep}
              onRemoveStep={handleRemoveStep}
            />
          </div>

          {/* Right: Configurator */}
          <div className="w-80">
            <StepConfigurator
              selectedStep={selectedStep}
              showTriggerConfig={showTriggerConfig && selectedStepId === null}
              trigger={flow.trigger}
              onUpdateStep={handleUpdateStep}
              onUpdateTrigger={(t) => { handleUpdateTrigger(t); setShowTriggerConfig(false) }}
              onClose={() => { setSelectedStepId(null); setShowTriggerConfig(false) }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

### Step 7: Create the editor page

- [ ] **Create `packages/admin/src/pages/automations/[id].astro`**

```astro
---
import AdminLayout from "../../layouts/AdminLayout.astro"
import { FlowEditor } from "../../components/automations/FlowEditor"

const { id } = Astro.params
---
<AdminLayout title="Edit Flow">
  <a href="/automations" class="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block">&larr; Back to Automations</a>
  <FlowEditor flowId={id!} client:load />
</AdminLayout>
```

### Step 8: Add Automations to sidebar

- [ ] **Modify `packages/admin/src/components/Sidebar.astro`** — add an Automations link in the bottom section, before the Webhooks link:

```astro
    <a href="/automations" class:list={[
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
      currentPath.startsWith("/automations")
        ? "bg-blue-50 text-blue-700 font-medium"
        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
    ]}>
      <span>⚡</span>
      <span>Automations</span>
    </a>
```

### Step 9: Commit

- [ ] **Commit**

```bash
git add packages/admin/src/components/automations/ packages/admin/src/pages/automations/ packages/admin/src/components/Sidebar.astro
git commit -m "feat(E4): automation flow list, editor, and canvas UI"
```

---

## Task E5: Step Configurator + Execution Viewer

**Files:**
- Create: `packages/admin/src/components/automations/StepConfigurator.tsx`
- Create: `packages/admin/src/components/automations/RunList.tsx`
- Create: `packages/admin/src/components/automations/RunDetail.tsx`

### Step 1: Create the StepConfigurator

- [ ] **Create `packages/admin/src/components/automations/StepConfigurator.tsx`**

```tsx
import type { FlowStep, FlowTrigger, ConditionStep, ActionStep, ConditionRule, ConditionOperator } from "./flow-types"

type Props = {
  selectedStep: FlowStep | null
  showTriggerConfig: boolean
  trigger: FlowTrigger
  onUpdateStep: (id: string, updates: Partial<FlowStep>) => void
  onUpdateTrigger: (trigger: FlowTrigger) => void
  onClose: () => void
}

const triggerTypes = [
  { value: "content.created", label: "Content Created" },
  { value: "content.updated", label: "Content Updated" },
  { value: "content.published", label: "Content Published" },
  { value: "content.deleted", label: "Content Deleted" },
  { value: "webhook.received", label: "Inbound Webhook" },
  { value: "schedule.cron", label: "Scheduled (Cron)" },
]

const operators: Array<{ value: ConditionOperator; label: string }> = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "matches", label: "matches regex" },
]

const cronPresets = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every day at midnight", value: "0 0 * * *" },
  { label: "Every Monday at 9am", value: "0 9 * * 1" },
]

function InputField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  )
}

function TextAreaField({ label, value, onChange, placeholder, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
    </div>
  )
}

export function StepConfigurator({ selectedStep, showTriggerConfig, trigger, onUpdateStep, onUpdateTrigger, onClose }: Props) {
  if (showTriggerConfig) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm text-gray-900">Trigger</h3>
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
          <select
            value={trigger.type}
            onChange={(e) => {
              const type = e.target.value
              if (type === "schedule.cron") onUpdateTrigger({ type: "schedule.cron", cron: "0 * * * *" })
              else if (type === "webhook.received") onUpdateTrigger({ type: "webhook.received" })
              else onUpdateTrigger({ type: type as any })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {triggerTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        {trigger.type !== "webhook.received" && trigger.type !== "schedule.cron" && (
          <InputField
            label="Collection (optional)"
            value={(trigger as any).collection ?? ""}
            onChange={(v) => onUpdateTrigger({ ...trigger, collection: v || undefined } as any)}
            placeholder="Leave empty for all collections"
          />
        )}
        {trigger.type === "schedule.cron" && (
          <div className="space-y-2">
            <InputField
              label="Cron Expression"
              value={(trigger as any).cron ?? ""}
              onChange={(v) => onUpdateTrigger({ type: "schedule.cron", cron: v })}
              placeholder="0 * * * *"
            />
            <div className="flex flex-wrap gap-1">
              {cronPresets.map(p => (
                <button key={p.value} onClick={() => onUpdateTrigger({ type: "schedule.cron", cron: p.value })} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full hover:bg-gray-200">
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!selectedStep) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
        Select a step to configure it, or click the trigger to change it.
      </div>
    )
  }

  if (selectedStep.type === "condition") {
    const step = selectedStep as ConditionStep
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm text-gray-900">Condition</h3>
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Match</label>
          <select
            value={step.match}
            onChange={(e) => onUpdateStep(step.id, { match: e.target.value as "all" | "any" } as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">All rules (AND)</option>
            <option value="any">Any rule (OR)</option>
          </select>
        </div>
        <div className="space-y-3">
          <label className="block text-xs font-medium text-gray-500">Rules</label>
          {step.rules.map((rule, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input value={rule.field} onChange={(e) => {
                const newRules = [...step.rules]
                newRules[i] = { ...rule, field: e.target.value }
                onUpdateStep(step.id, { rules: newRules } as any)
              }} placeholder="field.path" className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs" />
              <select value={rule.operator} onChange={(e) => {
                const newRules = [...step.rules]
                newRules[i] = { ...rule, operator: e.target.value as ConditionOperator }
                onUpdateStep(step.id, { rules: newRules } as any)
              }} className="px-2 py-1.5 border border-gray-300 rounded text-xs">
                {operators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
              </select>
              <input value={String(rule.value)} onChange={(e) => {
                const newRules = [...step.rules]
                newRules[i] = { ...rule, value: e.target.value }
                onUpdateStep(step.id, { rules: newRules } as any)
              }} placeholder="value" className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs" />
              <button onClick={() => {
                const newRules = step.rules.filter((_, idx) => idx !== i)
                onUpdateStep(step.id, { rules: newRules } as any)
              }} className="text-red-400 hover:text-red-600 text-xs px-1">x</button>
            </div>
          ))}
          <button onClick={() => {
            onUpdateStep(step.id, { rules: [...step.rules, { field: "", operator: "eq", value: "" }] } as any)
          }} className="text-xs text-blue-600 hover:text-blue-800">+ Add rule</button>
        </div>
      </div>
    )
  }

  // Action steps
  const step = selectedStep as ActionStep
  const config = step.config as Record<string, string>
  const setConfig = (key: string, value: string) => {
    onUpdateStep(step.id, { config: { ...step.config, [key]: value } } as any)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm text-gray-900">{step.type.replace("action.", "").replace("_", " ").replace(/^\w/, c => c.toUpperCase())}</h3>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
      </div>
      <InputField label="Label (optional)" value={step.label ?? ""} onChange={(v) => onUpdateStep(step.id, { label: v } as any)} placeholder="Step name" />

      {step.type === "action.webhook" && (
        <>
          <InputField label="URL" value={String(config.url ?? "")} onChange={(v) => setConfig("url", v)} placeholder="https://example.com/webhook" />
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Method</label>
            <select value={String(config.method ?? "POST")} onChange={(e) => setConfig("method", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>
        </>
      )}

      {step.type === "action.email" && (
        <>
          <InputField label="To" value={String(config.to ?? "")} onChange={(v) => setConfig("to", v)} placeholder="user@example.com" />
          <InputField label="Subject" value={String(config.subject ?? "")} onChange={(v) => setConfig("subject", v)} placeholder="Subject line (supports {{payload.field}})" />
        </>
      )}

      {(step.type === "action.create_content" || step.type === "action.update_content") && (
        <>
          <InputField label="Collection" value={String(config.collection ?? "")} onChange={(v) => setConfig("collection", v)} placeholder="posts" />
          {step.type === "action.update_content" && (
            <InputField label="Document ID" value={String(config.documentId ?? "")} onChange={(v) => setConfig("documentId", v)} placeholder="{{payload.document.id}}" />
          )}
          <TextAreaField label="Data mapping (JSON)" value={typeof config.data === "object" ? JSON.stringify(config.data, null, 2) : String(config.data ?? "{}")} onChange={(v) => {
            try { setConfig("data", JSON.parse(v)) } catch {}
          }} placeholder='{"title": "payload.document.title"}' />
        </>
      )}

      {step.type === "action.delete_content" && (
        <>
          <InputField label="Collection" value={String(config.collection ?? "")} onChange={(v) => setConfig("collection", v)} placeholder="posts" />
          <InputField label="Document ID" value={String(config.documentId ?? "")} onChange={(v) => setConfig("documentId", v)} placeholder="{{payload.document.id}}" />
        </>
      )}

      {step.type === "action.log" && (
        <TextAreaField label="Message" value={String(config.message ?? "")} onChange={(v) => setConfig("message", v)} placeholder="Doc {{payload.document.title}} was created" />
      )}

      {step.type === "action.transform" && (
        <TextAreaField label="Mappings (JSON)" value={typeof config.mappings === "object" ? JSON.stringify(config.mappings, null, 2) : String(config.mappings ?? "{}")} onChange={(v) => {
          try { setConfig("mappings", JSON.parse(v)) } catch {}
        }} placeholder='{"title": "payload.document.title", "url": "payload.document.slug"}' rows={6} />
      )}

      <p className="text-xs text-gray-400">Use <code className="bg-gray-100 px-1 rounded">{"{{payload.field.path}}"}</code> to reference trigger data.</p>
    </div>
  )
}
```

### Step 2: Create RunList component

- [ ] **Create `packages/admin/src/components/automations/RunList.tsx`**

```tsx
import { useState, useEffect } from "react"
import { RunDetail } from "./RunDetail"
import type { FlowRun, FlowStep } from "./flow-types"

type Props = {
  flowId: string
  apiBase?: string
  steps: FlowStep[]
}

const statusBadge: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  running: "bg-gray-100 text-gray-500",
}

export function RunList({ flowId, apiBase = "", steps }: Props) {
  const [runs, setRuns] = useState<FlowRun[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const limit = 20

  useEffect(() => { fetchRuns() }, [offset])

  const fetchRuns = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/api/_flows/${flowId}/runs?limit=${limit}&offset=${offset}`)
      if (res.ok) {
        const data = await res.json()
        setRuns(data.data || [])
      }
    } catch {} finally { setLoading(false) }
  }

  if (selectedRunId) {
    return (
      <div>
        <button onClick={() => setSelectedRunId(null)} className="text-sm text-blue-600 hover:text-blue-800 mb-4">&larr; Back to runs</button>
        <RunDetail flowId={flowId} runId={selectedRunId} apiBase={apiBase} steps={steps} />
      </div>
    )
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading runs...</p>

  return (
    <div className="space-y-4">
      {runs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          No runs yet. Trigger the flow to see execution history.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {runs.map((run) => {
            const duration = run.finished_at ? `${Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()))}ms` : "—"
            return (
              <button key={run.id} onClick={() => setSelectedRunId(run.id)} className="w-full text-left p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm text-gray-900">{new Date(run.started_at).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{run.trigger_event}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{duration}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge[run.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {run.status}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-300">Previous</button>
        <button onClick={() => setOffset(offset + limit)} disabled={runs.length < limit} className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-300">Next</button>
      </div>
    </div>
  )
}
```

### Step 3: Create RunDetail (replay debugger)

- [ ] **Create `packages/admin/src/components/automations/RunDetail.tsx`**

```tsx
import { useState, useEffect } from "react"
import { FlowCanvas } from "./FlowCanvas"
import type { FlowRun, FlowStep, FlowRunStep } from "./flow-types"

type Props = {
  flowId: string
  runId: string
  apiBase?: string
  steps: FlowStep[]
}

export function RunDetail({ flowId, runId, apiBase = "", steps }: Props) {
  const [run, setRun] = useState<(FlowRun & { steps: FlowRunStep[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)

  useEffect(() => {
    fetchRunDetail()
  }, [runId])

  const fetchRunDetail = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/api/_flows/${flowId}/runs/${runId}`)
      if (res.ok) setRun(await res.json())
    } catch {} finally { setLoading(false) }
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading run detail...</p>
  if (!run) return <p className="text-red-500 text-sm">Run not found.</p>

  const selectedRunStep = run.steps.find(rs => rs.step_id === selectedStepId) ?? null

  const statusBadge: Record<string, string> = {
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    running: "bg-gray-100 text-gray-500",
  }

  const duration = run.finished_at
    ? `${Math.round(new Date(run.finished_at).getTime() - new Date(run.started_at).getTime())}ms`
    : "still running"

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">{new Date(run.started_at).toLocaleString()}</p>
          <p className="text-xs text-gray-500">{run.trigger_event} — {duration}</p>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full ${statusBadge[run.status] ?? "bg-gray-100 text-gray-500"}`}>
          {run.status}
        </span>
      </div>

      {run.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{run.error}</div>
      )}

      <div className="flex gap-6">
        {/* Read-only canvas with status overlay */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 min-h-[400px] overflow-auto">
          <FlowCanvas
            trigger={{ type: run.trigger_event } as any}
            steps={steps}
            selectedStepId={selectedStepId}
            onSelectStep={setSelectedStepId}
            onSelectTrigger={() => {}}
            onAddStep={() => {}}
            onRemoveStep={() => {}}
            readOnly
            runSteps={run.steps}
          />
        </div>

        {/* Step detail panel */}
        <div className="w-80">
          {selectedRunStep ? (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
              <h3 className="font-medium text-sm text-gray-900">Step: {selectedRunStep.step_id}</h3>
              <div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge[selectedRunStep.status] ?? ""}`}>
                  {selectedRunStep.status}
                </span>
                {selectedRunStep.branch_taken && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ml-2">
                    Branch: {selectedRunStep.branch_taken}
                  </span>
                )}
              </div>
              {selectedRunStep.started_at && selectedRunStep.finished_at && (
                <p className="text-xs text-gray-400">
                  {Math.round(new Date(selectedRunStep.finished_at).getTime() - new Date(selectedRunStep.started_at).getTime())}ms
                </p>
              )}
              {selectedRunStep.input && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Input</p>
                  <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-auto max-h-48 text-gray-700">{JSON.stringify(JSON.parse(selectedRunStep.input), null, 2)}</pre>
                </div>
              )}
              {selectedRunStep.output && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Output</p>
                  <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-auto max-h-48 text-gray-700">{JSON.stringify(JSON.parse(selectedRunStep.output), null, 2)}</pre>
                </div>
              )}
              {selectedRunStep.error && (
                <div>
                  <p className="text-xs font-medium text-red-500 mb-1">Error</p>
                  <pre className="text-xs bg-red-50 p-3 rounded-lg overflow-auto max-h-48 text-red-700">{selectedRunStep.error}</pre>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
              Click a step to see its execution data.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

### Step 4: Commit

- [ ] **Commit**

```bash
git add packages/admin/src/components/automations/StepConfigurator.tsx packages/admin/src/components/automations/RunList.tsx packages/admin/src/components/automations/RunDetail.tsx
git commit -m "feat(E5): step configurator and execution replay viewer"
```

### Step 5: Start dev server and verify

- [ ] **Start the dev server**

Run: `bun run dev` (or whichever script starts both API and admin)

- [ ] **Verify manually:**
  1. Navigate to `/automations` — flow list page loads
  2. Click "+ New Flow" — redirects to editor with a default flow
  3. Click the trigger block — trigger config panel appears on right
  4. Click `[ + ]` — step picker popup shows all action types
  5. Add a Log action — configurator panel shows message textarea
  6. Click Save — flow persists (refresh confirms)
  7. Toggle active state — badge changes

### Step 6: Final commit (merge all Phase E)

- [ ] **Commit any remaining fixes**

```bash
git add -A
git commit -m "feat(phase-e): visual automations - flows, engine, builder, and replay debugger"
```
