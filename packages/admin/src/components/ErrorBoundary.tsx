import { Component, type ReactNode } from "react"

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
        <div className="rounded-xl border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.1)] p-6 text-center">
          <p className="text-[#ef4444] font-medium mb-1">Something went wrong</p>
          <p className="text-[#ef4444] text-sm mb-4 opacity-75">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 text-sm font-medium bg-transparent border border-[rgba(255,255,255,0.06)] rounded-lg text-[#a1a1aa] hover:bg-[rgba(255,255,255,0.03)] transition-colors"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
