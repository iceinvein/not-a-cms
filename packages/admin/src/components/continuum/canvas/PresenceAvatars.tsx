import type { CollabPresenceUser } from "@not-a-cms/editor"
import { readableTextColor, safeCssColor } from "@not-a-cms/editor"

type Props = {
  /** Online collaborators (already excludes the local user; provided by the Editor's callback). */
  users: CollabPresenceUser[]
}

/**
 * A stacked, overlapping avatar group for the canvas top strip. Each avatar is the collaborator's
 * initial on their assigned color, with a readable text color and a name tooltip. Renders nothing
 * when no one else is in the document, so the strip stays quiet in the common single-editor case.
 */
export function PresenceAvatars({ users }: Props) {
  if (users.length === 0) return null
  return (
    // biome-ignore lint/a11y/useSemanticElements: fieldset is semantically wrong here; a generic group div is the correct container for avatar chips
    <div className="cn-presence-avatars" role="group" aria-label="Collaborators">
      {users.map(({ clientId, user }) => {
        const color = safeCssColor(user.color)
        const initial = (user.name.trim()[0] ?? "?").toUpperCase()
        return (
          <span
            key={clientId}
            className="cn-presence-avatar"
            title={user.name}
            style={{ background: color, color: readableTextColor(color) }}
          >
            {initial}
          </span>
        )
      })}
    </div>
  )
}
