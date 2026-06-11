// packages/admin/src/components/continuum/canvas/InsertMenu.tsx
import { blockSpecs } from "../blocks/specs"

type Props = {
  onPick: (type: string) => void
  onClose: () => void
}

const GROUP_ORDER = ["sections", "fields"] as const

/**
 * Compact block picker shown when the canvas `+` inserter is clicked. Lists every block spec
 * grouped by `group` (sections, then fields); picking one inserts that block type at the gap.
 * Prose blocks are inserted by typing or the slash menu, not here.
 */
export function InsertMenu({ onPick, onClose }: Props) {
  const groups = GROUP_ORDER.map((group) => ({
    group,
    specs: blockSpecs.filter((s) => (s.group ?? "fields") === group),
  })).filter((g) => g.specs.length > 0)

  return (
    <div className="cn-insert-menu" role="menu" aria-label="Insert a block">
      {groups.map(({ group, specs }) => (
        <div key={group} className="cn-insert-group">
          <p className="cn-insert-group-label">{group}</p>
          {specs.map((spec) => (
            <button
              key={spec.name}
              type="button"
              role="menuitem"
              className="cn-insert-item"
              data-type={spec.name}
              onClick={() => {
                onPick(spec.name)
                onClose()
              }}
            >
              {spec.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
