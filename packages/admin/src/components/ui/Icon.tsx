import {
  LayoutGrid,
  FileText,
  Image as ImageIcon,
  Webhook,
  Settings,
  Search,
  ChevronLeft,
  Command,
  type LucideIcon,
} from "lucide-react"

const ICONS = {
  dashboard: LayoutGrid,
  collection: FileText,
  media: ImageIcon,
  webhooks: Webhook,
  settings: Settings,
  search: Search,
  collapse: ChevronLeft,
  command: Command,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICONS

export function Icon({
  name,
  size = 16,
  className,
}: {
  name: IconName
  size?: number
  className?: string
}) {
  const Glyph = ICONS[name]
  return <Glyph size={size} strokeWidth={2} className={className} aria-hidden="true" />
}
