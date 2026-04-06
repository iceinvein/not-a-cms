export type FieldAccess = {
  read?: string[];
  write?: string[];
};

export type BaseFieldDef = {
  type: string;
  required: boolean;
  access?: FieldAccess;
};

export type TextFieldDef = BaseFieldDef & {
  type: "text";
  maxLength?: number;
  multiline?: boolean;
  default?: string;
};

export type SlugFieldDef = BaseFieldDef & {
  type: "slug";
  from: string;
  unique: boolean;
};

export type RichTextFieldDef = BaseFieldDef & {
  type: "richText";
};

export type NumberFieldDef = BaseFieldDef & {
  type: "number";
  min?: number;
  max?: number;
  default?: number;
};

export type BooleanFieldDef = BaseFieldDef & {
  type: "boolean";
  default?: boolean;
};

export type DatetimeFieldDef = BaseFieldDef & {
  type: "datetime";
  default?: string;
};

export type SelectFieldDef = BaseFieldDef & {
  type: "select";
  options: string[];
  default?: string;
};

export type RelationFieldDef = BaseFieldDef & {
  type: "relation";
  target: string;
};

export type MediaFieldDef = BaseFieldDef & {
  type: "media";
  accept?: string[];
};

export type ArrayFieldDef = BaseFieldDef & {
  type: "array";
  items: FieldDef;
};

export type GroupFieldDef = BaseFieldDef & {
  type: "group";
  fields: Record<string, FieldDef>;
};

export type PageLayoutFieldDef = BaseFieldDef & {
  type: "pageLayout";
};

export type FieldDef =
  | TextFieldDef
  | SlugFieldDef
  | RichTextFieldDef
  | NumberFieldDef
  | BooleanFieldDef
  | DatetimeFieldDef
  | SelectFieldDef
  | RelationFieldDef
  | MediaFieldDef
  | ArrayFieldDef
  | GroupFieldDef
  | PageLayoutFieldDef;

export type ContentStatus = "draft" | "in_review" | "published" | "archived";

export type HookContext = {
  collection: string;
  db: unknown;
};

export type ContentHook<T> = (
  doc: T,
  ctx: HookContext
) => T | Promise<T> | void | Promise<void>;

export type CollectionHooks = {
  beforeSave?: ContentHook<unknown>;
  afterSave?: ContentHook<unknown>;
  beforePublish?: ContentHook<unknown>;
  afterPublish?: ContentHook<unknown>;
  beforeDelete?: ContentHook<unknown>;
  afterDelete?: ContentHook<unknown>;
};

export type CollectionDef = {
  name: string;
  labels: {
    singular: string;
    plural: string;
  };
  fields: Record<string, FieldDef>;
  hooks?: CollectionHooks;
};
