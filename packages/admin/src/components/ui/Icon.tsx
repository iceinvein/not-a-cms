import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  LayoutGrid,
  FileText,
  Image as ImageIcon,
  Radio,
  Webhook,
  Settings,
  Search,
  ChevronLeft,
  Command,
  type LucideIcon,
} from "lucide-react"

const ICONS = {
  alert: AlertTriangle,
  calendar: CalendarClock,
  check: CheckCircle2,
  dot: CircleDot,
  dashboard: LayoutGrid,
  collection: FileText,
  media: ImageIcon,
  radio: Radio,
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
