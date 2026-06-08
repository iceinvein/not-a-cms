import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { EmptyState, ErrorState, LoadingState } from "../../src/components/AdminState"

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
})
