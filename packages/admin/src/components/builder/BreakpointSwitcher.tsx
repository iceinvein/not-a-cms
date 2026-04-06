import { type Breakpoint, BREAKPOINTS, BREAKPOINT_ORDER } from "../../lib/builder-types"

type BreakpointSwitcherProps = {
  active: Breakpoint
  onChange: (bp: Breakpoint) => void
}

const ICONS: Record<Breakpoint, string> = {
  desktop: "\u{1F5A5}",
  tablet: "\u{1F4F1}",
  mobile: "\u{1F4F2}",
}

export function BreakpointSwitcher({ active, onChange }: BreakpointSwitcherProps) {
  return (
    <div className="inline-flex items-center gap-1 bg-gray-100 rounded-full p-1">
      {BREAKPOINT_ORDER.map((bp) => {
        const isActive = bp === active
        const { label, maxWidth } = BREAKPOINTS[bp]
        return (
          <button
            key={bp}
            onClick={() => onChange(bp)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              isActive
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>{ICONS[bp]}</span>
            <span>{label}</span>
            <span className="text-gray-400">{maxWidth}px</span>
          </button>
        )
      })}
    </div>
  )
}
