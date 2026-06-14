export type PresencePerson = { id: string; name: string; color: string }

export function PresenceDots({ people, max = 4 }: { people: PresencePerson[]; max?: number }) {
  const shown = people.slice(0, max)
  const overflow = people.length - shown.length
  const noun = people.length === 1 ? "person" : "people"
  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: presence strip must stay inline */}
      <span className="pulse-presence" role="group" aria-label={`${people.length} ${noun} here`}>
        {shown.map((p) => (
          <span key={p.id} className="pulse-avatar" style={{ background: p.color }} title={p.name}>
            {initial(p.name)}
          </span>
        ))}
        {overflow > 0 ? <span className="pulse-avatar pulse-avatar-more">+{overflow}</span> : null}
      </span>
    </>
  )
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?"
}
