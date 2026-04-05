// Schema
export { field } from "./schema/field"
export { defineCollection } from "./schema/collection"

// Database
export { createDatabase, type AppDatabase, type DatabaseConfig } from "./db/connection"
export { generateTable } from "./db/generate-table"
export { bootstrapTables } from "./db/bootstrap"

// Content
export { createContentService } from "./content/service"

// Types
export type {
  FieldDef,
  TextFieldDef,
  SlugFieldDef,
  RichTextFieldDef,
  NumberFieldDef,
  BooleanFieldDef,
  DatetimeFieldDef,
  SelectFieldDef,
  RelationFieldDef,
  MediaFieldDef,
  ArrayFieldDef,
  GroupFieldDef,
  CollectionDef,
  CollectionHooks,
  ContentHook,
  HookContext,
  ContentStatus,
  FieldAccess,
} from "./types"
