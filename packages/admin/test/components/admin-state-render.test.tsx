import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
} from "../../src/components/AdminState"

describe("AdminState", () => {
  test("renders consistent loading, empty, and error states", () => {
    const loading = renderToString(
      <LoadingState title="Loading media" description="Fetching assets." />,
    )
    const empty = renderToString(
      <EmptyState
        title="No media yet"
        description="Upload files to reuse them across content."
        action={<button type="button">Upload</button>}
      />,
    )
    const error = renderToString(
      <ErrorState
        title="Permission needed"
        description="You do not have access."
        action={<button type="button">Try again</button>}
      />,
    )

    expect(loading).toContain("Loading media")
    expect(loading).toContain("Fetching assets.")
    expect(empty).toContain("No media yet")
    expect(empty).toContain("Upload")
    expect(error).toContain("Permission needed")
    expect(error).toContain("Try again")
  })

  test("ForbiddenState renders default admin-only copy in a neutral (non-error) tone", () => {
    const html = renderToString(<ForbiddenState />)

    expect(html).toContain("Admin access required")
    expect(html).toContain("administrator")
    // Neutral tone: must not use the red danger styling reserved for real errors.
    expect(html).not.toContain("239,68,68")
    expect(html).not.toContain("#ef4444")
  })

  test("ForbiddenState accepts custom description and an action", () => {
    const html = renderToString(
      <ForbiddenState
        description="Webhook configuration is limited to administrators."
        action={<button type="button">Back to dashboard</button>}
      />,
    )

    expect(html).toContain("Webhook configuration is limited to administrators.")
    expect(html).toContain("Back to dashboard")
  })
})
