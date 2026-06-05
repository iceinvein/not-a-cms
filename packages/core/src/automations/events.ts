import type { FlowRun, FlowRunStep } from "./types"

export type RunEvent =
  | { type: "run.started"; run: FlowRun }
  | { type: "run.step"; runId: string; flowId: string; step: FlowRunStep }
  | { type: "run.completed"; run: FlowRun }

export type RunEventBus = {
  /** Register a listener. Returns an unsubscribe function. */
  subscribe(fn: (event: RunEvent) => void): () => void
  /** Fan a run event out to every current subscriber. */
  publish(event: RunEvent): void
}

/** An in-process, synchronous pub/sub for live run progress. No buffering,
 *  no persistence: a fresh subscriber sees only events published after it
 *  subscribes (the Console does an initial fetch for history). */
export function createRunEventBus(): RunEventBus {
  const listeners = new Set<(event: RunEvent) => void>()
  return {
    subscribe(fn) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    publish(event) {
      for (const fn of listeners) {
        // A misbehaving subscriber must never break a run or block siblings.
        try {
          fn(event)
        } catch {
          // swallow
        }
      }
    },
  }
}
