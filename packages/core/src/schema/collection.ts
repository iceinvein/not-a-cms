import type { CollectionAccess, CollectionDef, CollectionHooks, FieldDef } from "../types";

type DefineCollectionInput = {
  name: string;
  labels?: {
    singular: string;
    plural: string;
  };
  fields: Record<string, FieldDef>;
  access?: CollectionAccess;
  hooks?: CollectionHooks;
};

function toTitleCase(snakeCase: string): string {
  return snakeCase
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function pluralize(singular: string): string {
  const lastWord = singular.split(" ").at(-1) ?? singular;
  const lower = lastWord.toLowerCase();

  if (lower.endsWith("y")) {
    return singular.slice(0, -1) + "ies";
  }
  if (lower.endsWith("x") || lower.endsWith("s")) {
    return singular + "es";
  }
  if (lower.endsWith("z")) {
    return singular + "zes";
  }
  return singular + "s";
}

export function defineCollection(input: DefineCollectionInput): CollectionDef {
  const { name, labels, fields, access, hooks } = input;

  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    throw new Error("Collection name must be snake_case");
  }

  const singular = labels?.singular ?? toTitleCase(name);
  const plural = labels?.plural ?? pluralize(singular);

  return {
    name,
    labels: { singular, plural },
    fields,
    ...(access !== undefined && { access }),
    ...(hooks !== undefined && { hooks }),
  };
}
