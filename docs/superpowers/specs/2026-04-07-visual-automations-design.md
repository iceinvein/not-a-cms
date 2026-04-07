# Phase E: Visual Automations — Design Spec

**Milestone:** M4 — Visual Automations
**Date:** 2026-04-07
**Status:** Approved

---

## Overview

A visual automation builder that lets users create event-driven workflows: "when X happens, do Y." Users wire together triggers, conditions, and actions in a vertical flow UI — no code required. Every execution is recorded with full per-step input/output replay for debugging.

**Scope:** Flows with if/else branching and conditions (Directus Flows level). Server-side execution only. No loops, parallel paths, or delays.

---

## Data Model

### Flow Document

A flow is a single JSON document stored in a TEXT column. This matches the existing pattern for Portable Text and page layouts.

```typescript
type Flow = {
  id: string
  name: string
  description?: string
  active: boolean
  trigger: FlowTrigger
  steps: FlowStep[]
  created_at: string
  updated_at: string
}
```

### Triggers

Six trigger types ship in Phase E:

```typescript
type FlowTrigger =
  | { type: "content.created"; collection?: string }
  | { type: "content.updated"; collection?: string }
  | { type: "content.published"; collection?: string }
  | { type: "content.deleted"; collection?: string }
  | { type: "webhook.received" }
  | { type: "schedule.cron"; cron: string }
```

- Content triggers fire after the corresponding `afterSave`/`afterPublish`/`afterDelete` hook in `createContentService`. The optional `collection` field scopes the trigger to a single collection; omitting it means "any collection."
- `webhook.received` generates a unique inbound URL per flow: `POST /api/_flows/:flowId/trigger`.
- `schedule.cron` uses standard cron syntax (e.g. `"0 * * * *"` for every hour). Evaluated on a 60-second interval, matching the existing scheduler pattern.

### Steps

Steps are either conditions (branching) or actions (side effects):

```typescript
type FlowStep = ConditionStep | ActionStep

type ConditionStep = {
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

type ConditionRule = {
  field: string
  operator: "eq" | "neq" | "contains" | "not_contains" | "matches" | "gt" | "lt"
  value: string | number | boolean
}

type ActionStep = {
  id: string
  type: ActionType
  label?: string
  config: Record<string, unknown>
  next: string | null
}

type ActionType =
  | "action.webhook"
  | "action.email"
  | "action.create_content"
  | "action.update_content"
  | "action.delete_content"
  | "action.log"
  | "action.transform"
```

### Action Configs

Each action type has a specific config shape:

| Action | Config fields |
|--------|---------------|
| `action.webhook` | `url: string`, `method: "POST" \| "PUT" \| "PATCH"`, `headers?: Record<string, string>` |
| `action.email` | `to: string`, `subject: string`, `template: string` (Portable Text JSON for MJML rendering) |
| `action.create_content` | `collection: string`, `data: Record<string, string>` (values can reference payload via `{{payload.field}}` syntax) |
| `action.update_content` | `collection: string`, `documentId: string`, `data: Record<string, string>` |
| `action.delete_content` | `collection: string`, `documentId: string` |
| `action.log` | `message: string` (supports `{{payload.field}}` interpolation) |
| `action.transform` | `mappings: Record<string, string>` (declarative field mapping — see Transform Action section) |

### Transform Action

The transform action uses **declarative field mappings** rather than arbitrary code execution. Each mapping is a key-value pair where the key is the output field name and the value is a dot-path expression referencing the input payload:

```json
{
  "type": "action.transform",
  "config": {
    "mappings": {
      "title": "payload.document.title",
      "author": "payload.document.author_name",
      "url": "payload.document.slug",
      "published": "payload.document.status"
    }
  }
}
```

Supported expressions:
- **Dot-path access:** `payload.document.title` → resolves nested fields
- **Literal strings:** `"hello"` → passes through as-is (quoted values)
- **Template strings:** `"Published: {{payload.document.title}}"` → interpolation within strings

This avoids arbitrary code execution entirely. If users need complex transformations, they can chain multiple transform steps or use a webhook action to call an external function.

### DB Tables

Three new tables:

```sql
CREATE TABLE _flows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger TEXT NOT NULL,       -- JSON: FlowTrigger
  steps TEXT NOT NULL,         -- JSON: FlowStep[]
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE _flow_runs (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL REFERENCES _flows(id) ON DELETE CASCADE,
  trigger_event TEXT NOT NULL,  -- e.g. "content.published"
  trigger_payload TEXT,         -- JSON: the trigger data
  status TEXT NOT NULL,         -- "running" | "completed" | "failed"
  started_at TEXT NOT NULL,
  finished_at TEXT,
  error TEXT
);

CREATE TABLE _flow_run_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES _flow_runs(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,        -- references FlowStep.id within the flow JSON
  status TEXT NOT NULL,         -- "running" | "completed" | "failed" | "skipped"
  input TEXT,                   -- JSON: payload entering this step
  output TEXT,                  -- JSON: payload leaving this step
  branch_taken TEXT,            -- "true" | "false" | null (for conditions)
  started_at TEXT NOT NULL,
  finished_at TEXT,
  error TEXT
);
```

---

## Engine Architecture

### Execution Model

The engine is a synchronous graph walker. When a trigger fires:

1. Find all active flows matching the trigger type and collection filter.
2. For each matching flow, spawn an async execution (non-blocking — does not delay the API response).
3. Create a `_flow_runs` row with status `"running"`.
4. Resolve the first step (`steps[0]`).
5. For each step:
   a. Record the step's input payload in `_flow_run_steps`.
   b. Execute the step (evaluate condition or run action).
   c. Record the step's output (or error).
   d. Resolve the next step ID (`next` for actions, `branches.true`/`branches.false` for conditions).
   e. If next is `null`, mark the run as `"completed"`.
   f. If the step throws, mark both the step and the run as `"failed"`, stop execution.

### Payload Threading

Each step receives the output of the previous step as its input. The first step receives the trigger payload:

- **Content triggers:** `{ event: "content.published", collection: "posts", document: { ...the full doc } }`
- **Inbound webhook:** `{ event: "webhook.received", body: { ...request body }, headers: { ... } }`
- **Cron:** `{ event: "schedule.cron", timestamp: "2026-04-07T12:00:00Z" }`

Action steps pass their result as the output (e.g., `action.webhook` passes the response body, `action.create_content` passes the created document). Condition steps pass the input through unchanged — they only decide which branch to take.

### Integration with Content Service

The automation dispatcher is injected into `createContentService` as an optional dependency, matching the pattern of `versioning` and `search`:

```typescript
export function createContentService(
  db: AppDatabase,
  collection: CollectionDef,
  table: AnyTable,
  versioning?: VersioningService,
  search?: SearchService,
  automations?: { dispatch: (event: string, collection: string, doc: Record<string, unknown>) => void },
) {
```

Dispatch calls are added after each `runHook()` call:

- After `afterSave` in `create()` → `automations?.dispatch("content.created", ...)`
- After `afterSave` in `update()` → `automations?.dispatch("content.updated", ...)`
- After `afterSave` in `update()` when status *transitions* to `"published"` (was not published before, now is) → `automations?.dispatch("content.published", ...)`. Updates to already-published documents fire `content.updated` only, not `content.published` again.
- After `afterDelete` in `remove()` → `automations?.dispatch("content.deleted", ...)`

Dispatch is fire-and-forget — errors in automation execution never propagate to the content operation.

### Cron and Inbound Webhook Triggers

- **Cron:** A `setInterval` loop (60-second interval, matching the existing scheduler) iterates active flows with `schedule.cron` triggers. Uses a simple cron expression matcher to check if the current minute matches. Runs on the same server process.
- **Inbound webhook:** `POST /api/_flows/:flowId/trigger` is a public endpoint. It validates that the flow exists and is active, has a `webhook.received` trigger, then kicks off execution with the request body as payload.

### Retry Policy

- HTTP actions (`action.webhook`, `action.email`) retry up to 3 times with exponential backoff: 1s, 5s, 15s. Matches the existing webhook service pattern.
- Content CRUD and log/transform actions do not retry — they succeed or fail immediately.
- Each retry attempt is recorded in the step's output for debugging.

### Auto-Cleanup

Runs older than 30 days are pruned automatically on the same 60-second interval that checks cron triggers. This prevents unbounded storage growth. The retention period is not configurable in Phase E (can be exposed in a future settings page).

---

## Admin UI

### Flow List Page (`/automations`)

A new admin page showing all flows in a table:

| Column | Content |
|--------|---------|
| Name | Flow name (link to editor) |
| Trigger | Badge showing trigger type (e.g. "content.published") |
| Active | Toggle switch |
| Last run | Timestamp + status badge (green/red) |
| Runs | Total run count |
| Actions | Delete button |

A "New Flow" button creates a flow with a default name and empty steps, redirecting to the editor.

### Flow Editor (`/automations/:id`)

Three regions:

**Top bar:**
- Editable flow name
- Active/inactive toggle
- Save button
- "Runs" tab (switches to execution viewer)

**Left — Vertical flow canvas:**
- Trigger block at the top (click to configure)
- Steps rendered top-to-bottom as connected blocks
- Condition blocks fork into two vertical lanes (true/false labels), merging back at the next step
- `[ + Add step ]` buttons between every pair of steps
- Click `[ + ]` to open a picker: "Condition" or action type submenu (Webhook, Email, Create Content, Update Content, Delete Content, Log, Transform)
- Drag steps to reorder (uses @dnd-kit, already installed from Phase D)
- Click any block to select it and show its config on the right

**Right — Configuration panel:**
- Contextual form based on the selected step type:
  - **Trigger:** Collection filter dropdown, cron expression input (with common presets)
  - **Condition:** Field name input, operator dropdown (eq/neq/contains/matches/gt/lt), value input. Multiple rules with AND/OR toggle. Add/remove rule buttons.
  - **action.webhook:** URL input, method dropdown, headers key-value editor
  - **action.email:** To field, subject field, template selector or inline editor
  - **action.create_content / update_content:** Collection dropdown, data mapping fields with `{{payload.field}}` interpolation hints
  - **action.delete_content:** Collection dropdown, document ID field
  - **action.log:** Message textarea with interpolation hints
  - **action.transform:** Declarative field mapping editor — key-value pairs with dot-path expressions

### Execution Viewer (Replay Debugger)

Accessed via the "Runs" tab in the flow editor.

**Run list:**
- Table: timestamp, trigger event, status badge (green = completed, red = failed, gray = running), duration, step count
- Paginated (matching existing content list pattern)
- Click a run to open detail

**Run detail:**
- The same vertical flow canvas, rendered read-only
- Each step block is color-coded by its status: green (completed), red (failed), gray (skipped/not reached)
- Click any step — right panel shows:
  - **Input:** formatted JSON viewer showing the payload that entered this step
  - **Output:** formatted JSON viewer showing the payload that left (or error message if failed)
  - **Timing:** started_at, finished_at, duration in ms
  - **Branch taken** (conditions only): which path was followed and the rule evaluation results

---

## REST API

### Flow CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/_flows` | List all flows |
| `POST` | `/api/_flows` | Create a new flow |
| `GET` | `/api/_flows/:id` | Get a single flow |
| `PATCH` | `/api/_flows/:id` | Update a flow |
| `DELETE` | `/api/_flows/:id` | Delete a flow (cascades to runs) |
| `POST` | `/api/_flows/:id/toggle` | Toggle flow active state |

### Inbound Trigger

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/_flows/:id/trigger` | Public endpoint — fires inbound webhook trigger |

### Execution History

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/_flows/:id/runs` | List runs for a flow (paginated: `?limit=&offset=`) |
| `GET` | `/api/_flows/:id/runs/:runId` | Get run detail with all step data |
| `DELETE` | `/api/_flows/:id/runs` | Manually purge old runs |

All endpoints except the inbound trigger require admin authentication (existing auth middleware). The inbound trigger endpoint is public but validates that the flow is active and has `webhook.received` trigger type.

---

## Package Ownership

| Package | New modules |
|---------|-------------|
| `core` | `automations/types.ts`, `automations/engine.ts`, `automations/store.ts`, `automations/cron.ts` |
| `server` | `automations/handler.ts` (REST routes), wiring in `index.ts` |
| `admin` | `components/automations/FlowList.tsx`, `FlowEditor.tsx`, `FlowCanvas.tsx`, `StepConfigurator.tsx`, `RunList.tsx`, `RunDetail.tsx`; pages `automations/index.astro`, `automations/[id].astro` |

No new npm dependencies. Reuses @dnd-kit (Phase D), existing Tailwind, React island pattern, MJML email channel (Phase C).

---

## Security Considerations

- **No arbitrary code execution.** The transform action uses declarative dot-path field mappings, not eval or dynamic function constructors. Users cannot execute arbitrary JavaScript.
- **Inbound webhook endpoint** is public by design but scoped: it only fires flows with `webhook.received` trigger type. Rate limiting should be considered for production deployments (out of scope for Phase E, can be added at the reverse proxy level).
- **Content CRUD actions** execute with full admin privileges. This is acceptable because only admin users can create flows. Document this in the UI.
- **Template interpolation** (`{{payload.field}}`) uses simple string replacement with dot-path resolution — no expression evaluation, no prototype chain traversal. The resolver walks own properties only.

---

## What's Explicitly Out of Scope

- Parallel branches (steps execute sequentially)
- Delay/wait steps
- Loop/iteration steps
- Client-side triggers (admin UI events)
- Configurable retention period (hardcoded 30 days)
- Flow versioning (only the latest version is stored)
- Flow import/export (trivial to add later since flows are JSON)
- Flow templates/presets
- Rate limiting on inbound webhook endpoint
