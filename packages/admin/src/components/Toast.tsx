import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react"

type ToastType = "success" | "error" | "info"

/** An optional call-to-action rendered inside a toast (e.g. "View live" after publishing). */
export type ToastAction = { label: string; href?: string; onClick?: () => void }

type Toast = {
  id: string
  message: string
  type: ToastType
  action?: ToastAction
}

type ToastContextValue = {
  addToast: (message: string, type?: ToastType, action?: ToastAction) => void
}

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback(
    (message: string, type: ToastType = "info", action?: ToastAction) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { id, message, type, action }])
    },
    [],
  )

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  // Action toasts (e.g. "View live") get longer to be clicked, and any toast pauses its
  // auto-dismiss while hovered so a message can't slip away mid-read (WCAG 2.2.1).
  const [paused, setPaused] = useState(false)
  const duration = toast.action ? 8000 : 4000

  useEffect(() => {
    if (paused) return
    const timer = setTimeout(() => onDismiss(toast.id), duration)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss, paused, duration])

  const colors: Record<ToastType, string> = {
    success: "bg-[rgba(34,197,94,0.15)] text-[#22c55e] border border-[rgba(34,197,94,0.2)]",
    error: "bg-[rgba(239,68,68,0.15)] text-[#ef4444] border border-[rgba(239,68,68,0.2)]",
    info: "bg-[#18181b] text-[#a1a1aa] border border-[rgba(255,255,255,0.06)]",
  }

  const { action } = toast

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover only pauses auto-dismiss on this live-region toast; it is a non-essential enhancement (keyboard users keep the full duration plus the dismiss button), not a primary interaction
    <div
      role={toast.type === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`${colors[toast.type]} px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-3 shadow-[0_18px_50px_rgba(0,0,0,0.18)]`}
    >
      <span>{toast.message}</span>
      {action ? (
        action.href ? (
          <a
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onDismiss(toast.id)}
            className="underline underline-offset-2 font-semibold opacity-90 hover:opacity-100 whitespace-nowrap"
          >
            {action.label}
          </a>
        ) : (
          <button
            type="button"
            onClick={() => {
              action.onClick?.()
              onDismiss(toast.id)
            }}
            className="underline underline-offset-2 font-semibold opacity-90 hover:opacity-100 whitespace-nowrap"
          >
            {action.label}
          </button>
        )
      ) : null}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="opacity-70 hover:opacity-100"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  )
}
