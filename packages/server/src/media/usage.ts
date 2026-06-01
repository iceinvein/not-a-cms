type FieldDef = { type: string }
type CollectionEntry = {
  def: {
    name: string
    labels?: { plural?: string }
    fields: Record<string, FieldDef>
  }
  table: unknown
}
type DocRow = { id: string; [key: string]: unknown }

export type UsageReference = {
  collection: string
  documentId: string
  label: string
  field: string
}

export type Usage = {
  count: number
  references: UsageReference[]
}

type QueryFn = (table: string, column: string, assetId: string) => Promise<DocRow[]>
type CountFn = (table: string, column: string) => Promise<Record<string, number>>
type ScanFn = (assetId: string) => Promise<UsageReference[]>

function toSnake(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[\s-]+/g, "_").toLowerCase()
}

export function mediaColumn(field: string): string {
  return `${toSnake(field)}_id`
}

function label(row: DocRow): string {
  return String(row.title || row.name || row.slug || row.id)
}

function mediaFields(entry: CollectionEntry): string[] {
  return Object.entries(entry.def.fields)
    .filter(([, definition]) => definition.type === "media")
    .map(([name]) => name)
}

export async function computeMediaUsage(
  collections: Map<string, CollectionEntry>,
  assetId: string,
  queryFn: QueryFn,
  scanFn?: ScanFn,
): Promise<Usage> {
  const references: UsageReference[] = []

  for (const [name, entry] of collections) {
    for (const field of mediaFields(entry)) {
      const rows = await queryFn(entry.def.name, mediaColumn(field), assetId)
      for (const row of rows) {
        references.push({ collection: name, documentId: String(row.id), label: label(row), field })
      }
    }
  }

  if (scanFn) references.push(...await scanFn(assetId))

  return { count: references.length, references }
}

export async function computeUsageCounts(
  collections: Map<string, CollectionEntry>,
  countFn: CountFn,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}

  for (const entry of collections.values()) {
    for (const field of mediaFields(entry)) {
      const partial = await countFn(entry.def.name, mediaColumn(field))
      for (const [assetId, count] of Object.entries(partial)) {
        counts[assetId] = (counts[assetId] ?? 0) + count
      }
    }
  }

  return counts
}
