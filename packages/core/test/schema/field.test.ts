import { test, expect, describe } from "bun:test";
import { field } from "../../src/schema/field";

describe("field.text", () => {
  test("returns correct type with defaults", () => {
    const f = field.text();
    expect(f.type).toBe("text");
    expect(f.required).toBe(false);
  });

  test("stores options when provided", () => {
    const f = field.text({ required: true, maxLength: 200, multiline: true, default: "hello" });
    expect(f.required).toBe(true);
    expect(f.maxLength).toBe(200);
    expect(f.multiline).toBe(true);
    expect(f.default).toBe("hello");
  });
});

describe("field.slug", () => {
  test("stores from and unique", () => {
    const f = field.slug({ from: "title", unique: true });
    expect(f.type).toBe("slug");
    expect(f.from).toBe("title");
    expect(f.unique).toBe(true);
    expect(f.required).toBe(false);
  });

  test("unique defaults to true", () => {
    const f = field.slug({ from: "title" });
    expect(f.unique).toBe(true);
  });
});

describe("field.richText", () => {
  test("returns correct type", () => {
    const f = field.richText();
    expect(f.type).toBe("richText");
    expect(f.required).toBe(false);
  });
});

describe("field.number", () => {
  test("returns correct type with defaults", () => {
    const f = field.number();
    expect(f.type).toBe("number");
    expect(f.required).toBe(false);
  });

  test("stores options when provided", () => {
    const f = field.number({ required: true, min: 0, max: 100, default: 42 });
    expect(f.required).toBe(true);
    expect(f.min).toBe(0);
    expect(f.max).toBe(100);
    expect(f.default).toBe(42);
  });
});

describe("field.boolean", () => {
  test("stores default", () => {
    const f = field.boolean({ default: false });
    expect(f.type).toBe("boolean");
    expect(f.required).toBe(false);
    expect(f.default).toBe(false);
  });
});

describe("field.datetime", () => {
  test("returns correct type", () => {
    const f = field.datetime();
    expect(f.type).toBe("datetime");
    expect(f.required).toBe(false);
  });
});

describe("field.select", () => {
  test("stores options and default", () => {
    const f = field.select(["draft", "published"], { default: "draft" });
    expect(f.type).toBe("select");
    expect(f.options).toEqual(["draft", "published"]);
    expect(f.default).toBe("draft");
    expect(f.required).toBe(false);
  });
});

describe("field.relation", () => {
  test("stores target", () => {
    const f = field.relation("user");
    expect(f.type).toBe("relation");
    expect(f.target).toBe("user");
    expect(f.required).toBe(false);
  });
});

describe("field.media", () => {
  test("stores accept", () => {
    const f = field.media({ accept: ["image/*"] });
    expect(f.type).toBe("media");
    expect(f.accept).toEqual(["image/*"]);
    expect(f.required).toBe(false);
  });
});

describe("field.array", () => {
  test("wraps items", () => {
    const items = field.text();
    const f = field.array(items);
    expect(f.type).toBe("array");
    expect(f.items).toBe(items);
    expect(f.required).toBe(false);
  });
});

describe("field.group", () => {
  test("nests fields", () => {
    const fields = {
      metaTitle: field.text(),
      metaDescription: field.text({ maxLength: 160 }),
    };
    const f = field.group(fields);
    expect(f.type).toBe("group");
    expect(f.fields).toBe(fields);
    expect(f.fields.metaTitle.type).toBe("text");
    expect(f.fields.metaDescription.maxLength).toBe(160);
    expect(f.required).toBe(false);
  });
});

describe("field.pageLayout", () => {
  test("field.pageLayout() returns correct type", () => {
    const f = field.pageLayout();
    expect(f.type).toBe("pageLayout");
    expect(f.required).toBe(false);
  });

  test("field.pageLayout({ required: true }) sets required", () => {
    const f = field.pageLayout({ required: true });
    expect(f.required).toBe(true);
  });
});
