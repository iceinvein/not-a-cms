import { Component, type ReactNode } from "react"
import { ErrorState } from "./AdminState"

type Props = {
  children: ReactNode
  fallback?: ReactNode
}

type State = {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <ErrorState
          title="This section could not render"
          description={this.state.error?.message || "Refresh the section and try again."}
          action={
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 text-sm font-medium bg-transparent border border-[rgba(255,255,255,0.06)] rounded-lg text-[#a1a1aa] hover:bg-[rgba(255,255,255,0.03)] transition-colors"
            >
              Try again
            </button>
          }
        />
      )
    }

    return this.props.children
  }
}
