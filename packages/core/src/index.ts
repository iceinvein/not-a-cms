// Schema
export { field } from "./schema/field"
export { defineCollection } from "./schema/collection"

// Database
export { createDatabase, type AppDatabase, type DatabaseConfig } from "./db/connection"
export { generateTable } from "./db/generate-table"
export { bootstrapTables } from "./db/bootstrap"

// Migrations
export { createMigrator, type Migrator } from "./db/migrator"
export { generateMigrationSQL, generateCreateTableSQL } from "./db/schema-generator"

// Content
export { createContentService } from "./content/service"
export { slugify } from "./content/slugify"

// Versioning
export { createVersioningService, type VersioningService, type VersionRecord } from "./content/versioning"

// Search
export { createSearchService, extractTextFromPortableText, type SearchService, type SearchResult } from "./content/search"

// Scheduler
export { createScheduler, type Scheduler } from "./content/scheduler"

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
