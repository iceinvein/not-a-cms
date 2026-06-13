import { AlertDialog } from "@base-ui/react/alert-dialog"
import type { ReactNode } from "react"

export type ConfirmTone = "default" | "danger"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  heading: string
  body: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: ConfirmTone
  busy?: boolean
  onConfirm: () => void
}

/**
 * A controlled confirmation built on Base UI's AlertDialog (focus trap, Escape to
 * cancel, backdrop, and ARIA wiring handled by the primitive). Used to gate the
 * high-stakes actions the critique flagged as unguarded: publishing to the public
 * site and destructive deletes. The danger tone reuses the design system's status-error.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  heading,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  onConfirm,
}: Props) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="confirm-backdrop" />
        <AlertDialog.Viewport className="confirm-viewport">
          <AlertDialog.Popup className="confirm-popup">
            <AlertDialog.Title className="confirm-title">{heading}</AlertDialog.Title>
            <AlertDialog.Description className="confirm-body">{body}</AlertDialog.Description>
            <div className="confirm-actions">
              <AlertDialog.Close className="confirm-cancel" disabled={busy}>
                {cancelLabel}
              </AlertDialog.Close>
              <button
                type="button"
                className={`confirm-go${tone === "danger" ? " confirm-go-danger" : ""}`}
                disabled={busy}
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
