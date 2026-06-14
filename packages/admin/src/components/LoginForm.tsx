import { useEffect, useRef, useState } from "react"
import { adminApiFetch } from "../lib/api"

export type AuthMethodConfig = {
  magicLink: boolean
  oauthProviders: string[]
  passkey: boolean
}

type Props = {
  apiBase?: string
  initialAuthConfig?: AuthMethodConfig
}

const DEFAULT_AUTH_CONFIG: AuthMethodConfig = {
  magicLink: true,
  oauthProviders: [],
  passkey: false,
}

export function LoginForm({ apiBase = "", initialAuthConfig = DEFAULT_AUTH_CONFIG }: Props) {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState("")
  const [error, setError] = useState("")
  const [authConfig, setAuthConfig] = useState<AuthMethodConfig>(initialAuthConfig)
  const sentRef = useRef<HTMLDivElement>(null)

  // Move focus to the confirmation when the magic link is sent, so screen-reader users
  // hear that it worked (the form is replaced, so without this the change is silent).
  useEffect(() => {
    if (sent) sentRef.current?.focus()
  }, [sent])

  useEffect(() => {
    let cancelled = false
    adminApiFetch(apiBase, "/api/_auth/config")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load auth config")
        return res.json()
      })
      .then((config) => {
        if (!cancelled)
          setAuthConfig({
            magicLink: config.magicLink ?? true,
            oauthProviders: Array.isArray(config.oauthProviders) ? config.oauthProviders : [],
            passkey: Boolean(config.passkey),
          })
      })
      .catch(() => {
        if (!cancelled) setAuthConfig(initialAuthConfig)
      })
    return () => {
      cancelled = true
    }
  }, [apiBase, initialAuthConfig])

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await adminApiFetch(apiBase, "/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createMagicLinkPayload(email, window.location.origin)),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || "Failed to send magic link")
      }

      setSent(true)
    } catch (err: any) {
      setError(err.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = async (provider: string) => {
    setOauthLoading(provider)
    setError("")
    try {
      const res = await adminApiFetch(apiBase, "/api/auth/sign-in/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          callbackURL: `${window.location.origin}/`,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) throw new Error(data.message || "Failed to start OAuth sign-in")
      window.location.href = data.url
    } catch (err: any) {
      setError(err.message || "Something went wrong")
    } finally {
      setOauthLoading("")
    }
  }

  if (sent) {
    return (
      <div className="text-center py-4" ref={sentRef} tabIndex={-1} role="status">
        <h3 className="text-lg font-medium text-[#fafafa]">Check your email</h3>
        <p className="text-sm text-[#909099] mt-2">
          We sent a magic link to <strong>{email}</strong>
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false)
            setEmail("")
          }}
          className="text-sm text-[#909099] hover:text-[#a1a1aa] mt-4"
        >
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <div>
      {authConfig.oauthProviders.length > 0 && (
        <div className="mb-5 space-y-2">
          {authConfig.oauthProviders.map((provider) => (
            <button
              key={provider}
              type="button"
              onClick={() => handleOAuth(provider)}
              disabled={Boolean(oauthLoading)}
              className="w-full py-2 px-4 border border-[rgba(255,255,255,0.1)] rounded-md text-sm font-medium text-[#fafafa] hover:bg-[rgba(255,255,255,0.04)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {oauthLoading === provider
                ? "Opening..."
                : `Continue with ${providerLabel(provider)}`}
            </button>
          ))}
          {authConfig.magicLink && (
            <div className="flex items-center gap-3 py-2 text-xs uppercase tracking-[0.12em] text-[#838389]">
              <span className="h-px flex-1 bg-[rgba(255,255,255,0.08)]" />
              <span>Email</span>
              <span className="h-px flex-1 bg-[rgba(255,255,255,0.08)]" />
            </div>
          )}
        </div>
      )}

      {authConfig.magicLink && (
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-[#a1a1aa] mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 bg-transparent border border-[rgba(255,255,255,0.1)] rounded-lg text-sm text-[#fafafa] placeholder:text-[#838389] focus:outline-none focus:ring-0 focus:border-[rgba(255,255,255,0.2)]"
            />
          </div>
          {error && (
            <p className="text-sm text-[#ef4444] mb-4" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="w-full py-2 px-4 bg-[#fafafa] text-[#0a0a0c] rounded-md text-sm font-medium hover:bg-[#e4e4e7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Sending..." : "Send magic link"}
          </button>
        </form>
      )}

      {!authConfig.magicLink && error && (
        <p className="text-sm text-[#ef4444]" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function createMagicLinkPayload(
  email: string,
  origin: string,
): { email: string; callbackURL: string } {
  return {
    email,
    callbackURL: `${origin.replace(/\/+$/, "")}/`,
  }
}

function providerLabel(provider: string): string {
  switch (provider) {
    case "github":
      return "GitHub"
    case "google":
      return "Google"
    default:
      return provider
        .split(/[-_ ]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
  }
}
