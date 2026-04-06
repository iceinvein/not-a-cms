// Schema
export { field } from "./schema/field"
export { defineCollection } from "./schema/collection"

// Database
export { createDatabase, type AppDatabase, type DatabaseConfig } from "./db/connection"
export { generateTable } from "./db/generate-table"
export { bootstrapTables } from "./db/bootstrap"

// Content
export { createContentService } from "./content/service"
export { slugify } from "./content/slugify"

// Versioning
export { createVersioningService, type VersioningService, type VersionRecord } from "./content/versioning"

// Search
export { createSearchService, extractTextFromPortableText, type SearchService, type SearchResult } from "./content/search"

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
