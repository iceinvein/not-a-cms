import type {
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
  FieldDef,
  FieldAccess,
} from "../types";

type BaseOpts = {
  required?: boolean;
  access?: FieldAccess;
};

type TextOpts = BaseOpts & {
  maxLength?: number;
  multiline?: boolean;
  default?: string;
};

type SlugOpts = BaseOpts & {
  from: string;
  unique?: boolean;
};

type NumberOpts = BaseOpts & {
  min?: number;
  max?: number;
  default?: number;
};

type BooleanOpts = BaseOpts & {
  default?: boolean;
};

type DatetimeOpts = BaseOpts & {
  default?: string;
};

type SelectOpts = BaseOpts & {
  default?: string;
};

type RelationOpts = BaseOpts;

type MediaOpts = BaseOpts & {
  accept?: string[];
};

type ArrayOpts = BaseOpts;

type GroupOpts = BaseOpts;

export const field = {
  text(opts: TextOpts = {}): TextFieldDef {
    const { required = false, access, maxLength, multiline, default: def } = opts;
    return {
      type: "text",
      required,
      ...(access !== undefined && { access }),
      ...(maxLength !== undefined && { maxLength }),
      ...(multiline !== undefined && { multiline }),
      ...(def !== undefined && { default: def }),
    };
  },

  slug(opts: SlugOpts): SlugFieldDef {
    const { from, unique = true, required = false, access } = opts;
    return {
      type: "slug",
      from,
      unique,
      required,
      ...(access !== undefined && { access }),
    };
  },

  richText(opts: BaseOpts = {}): RichTextFieldDef {
    const { required = false, access } = opts;
    return {
      type: "richText",
      required,
      ...(access !== undefined && { access }),
    };
  },

  number(opts: NumberOpts = {}): NumberFieldDef {
    const { required = false, access, min, max, default: def } = opts;
    return {
      type: "number",
      required,
      ...(access !== undefined && { access }),
      ...(min !== undefined && { min }),
      ...(max !== undefined && { max }),
      ...(def !== undefined && { default: def }),
    };
  },

  boolean(opts: BooleanOpts = {}): BooleanFieldDef {
    const { required = false, access, default: def } = opts;
    return {
      type: "boolean",
      required,
      ...(access !== undefined && { access }),
      ...(def !== undefined && { default: def }),
    };
  },

  datetime(opts: DatetimeOpts = {}): DatetimeFieldDef {
    const { required = false, access, default: def } = opts;
    return {
      type: "datetime",
      required,
      ...(access !== undefined && { access }),
      ...(def !== undefined && { default: def }),
    };
  },

  select(options: string[], opts: SelectOpts = {}): SelectFieldDef {
    const { required = false, access, default: def } = opts;
    return {
      type: "select",
      options,
      required,
      ...(access !== undefined && { access }),
      ...(def !== undefined && { default: def }),
    };
  },

  relation(target: string, opts: RelationOpts = {}): RelationFieldDef {
    const { required = false, access } = opts;
    return {
      type: "relation",
      target,
      required,
      ...(access !== undefined && { access }),
    };
  },

  media(opts: MediaOpts = {}): MediaFieldDef {
    const { required = false, access, accept } = opts;
    return {
      type: "media",
      required,
      ...(access !== undefined && { access }),
      ...(accept !== undefined && { accept }),
    };
  },

  array(items: FieldDef, opts: ArrayOpts = {}): ArrayFieldDef {
    const { required = false, access } = opts;
    return {
      type: "array",
      items,
      required,
      ...(access !== undefined && { access }),
    };
  },

  group(fields: Record<string, FieldDef>, opts: GroupOpts = {}): GroupFieldDef {
    const { required = false, access } = opts;
    return {
      type: "group",
      fields,
      required,
      ...(access !== undefined && { access }),
    };
  },
};
