import { prepareValueForField, type AdminFieldDef } from "./content-fields"

export function buildPayload(
  data: Record<string, unknown>,
  fields: Record<string, AdminFieldDef>,
  status?: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const [name, def] of Object.entries(fields)) {
    if (name === "status") continue
    payload[name] = prepareValueForField(data[name], def)
  }
  if (status !== undefined) payload.status = status
  return payload
}
