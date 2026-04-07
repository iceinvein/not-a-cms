import { useState } from "react"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/magic-link/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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

  if (sent) {
    return (
      <div className="text-center py-4">
        <h3 className="text-lg font-medium text-[#fafafa]">Check your email</h3>
        <p className="text-sm text-[#71717a] mt-2">
          We sent a magic link to <strong>{email}</strong>
        </p>
        <button
          onClick={() => { setSent(false); setEmail("") }}
          className="text-sm text-[#71717a] hover:text-[#a1a1aa] mt-4"
        >
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label htmlFor="email" className="block text-sm font-medium text-[#a1a1aa] mb-1">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-3 py-2 bg-transparent border border-[rgba(255,255,255,0.1)] rounded-lg text-sm text-[#fafafa] placeholder:text-[#52525b] focus:outline-none focus:ring-0 focus:border-[rgba(255,255,255,0.2)]"
        />
      </div>
      {error && (
        <p className="text-sm text-[#ef4444] mb-4">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 bg-[#fafafa] text-[#0a0a0c] rounded-md text-sm font-medium hover:bg-[#e4e4e7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Sending..." : "Send magic link"}
      </button>
    </form>
  )
}
