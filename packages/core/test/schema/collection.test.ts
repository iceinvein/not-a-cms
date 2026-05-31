import { test, expect, describe } from "bun:test";
import { field } from "../../src/schema/field";
import { defineCollection } from "../../src/schema/collection";
import { defineConfig } from "../../src/config";

describe("defineCollection", () => {
  test("creates a collection definition with all fields and verifies name, labels, field types", () => {
    const collection = defineCollection({
      name: "blog_post",
      labels: { singular: "Blog Post", plural: "Blog Posts" },
      fields: {
        title: field.text({ required: true }),
        slug: field.slug({ from: "title" }),
        body: field.richText(),
        published_at: field.datetime(),
        status: field.select(["draft", "published"], { default: "draft" }),
      },
    });

    expect(collection.name).toBe("blog_post");
    expect(collection.labels.singular).toBe("Blog Post");
    expect(collection.labels.plural).toBe("Blog Posts");
    expect(collection.fields.title.type).toBe("text");
    expect(collection.fields.slug.type).toBe("slug");
    expect(collection.fields.body.type).toBe("richText");
    expect(collection.fields.published_at.type).toBe("datetime");
    expect(collection.fields.status.type).toBe("select");
  });

  test("auto-generates labels from name when not provided", () => {
    const collection = defineCollection({
      name: "blog_post",
      fields: {
        title: field.text(),
      },
    });

    expect(collection.labels.singular).toBe("Blog Post");
    expect(collection.labels.plural).toBe("Blog Posts");
  });

  test("auto-generates plural with 'ies' for words ending in 'y'", () => {
    const collection = defineCollection({
      name: "category",
      fields: {},
    });

    expect(collection.labels.singular).toBe("Category");
    expect(collection.labels.plural).toBe("Categories");
  });

  test("auto-generates plural with 'es' for words ending in 's', 'x', or 'z'", () => {
    const collectionS = defineCollection({ name: "status", fields: {} });
    expect(collectionS.labels.plural).toBe("Statuses");

    const collectionX = defineCollection({ name: "tax", fields: {} });
    expect(collectionX.labels.plural).toBe("Taxes");

    const collectionZ = defineCollection({ name: "quiz", fields: {} });
    expect(collectionZ.labels.plural).toBe("Quizzes");
  });

  test("stores hooks when provided", () => {
    const beforeSave = () => {};
    const afterPublish = () => {};

    const collection = defineCollection({
      name: "article",
      fields: { title: field.text() },
      hooks: { beforeSave, afterPublish },
    });

    expect(collection.hooks).toBeDefined();
    expect(collection.hooks?.beforeSave).toBe(beforeSave);
    expect(collection.hooks?.afterPublish).toBe(afterPublish);
  });

  test("hooks are undefined when not provided", () => {
    const collection = defineCollection({
      name: "article",
      fields: { title: field.text() },
    });

    expect(collection.hooks).toBeUndefined();
  });

  test("throws for invalid collection name 'BlogPost'", () => {
    expect(() =>
      defineCollection({ name: "BlogPost", fields: {} })
    ).toThrow("Collection name must be snake_case");
  });

  test("throws for invalid collection name with spaces", () => {
    expect(() =>
      defineCollection({ name: "blog post", fields: {} })
    ).toThrow("Collection name must be snake_case");
  });

  test("throws for invalid collection name starting with number", () => {
    expect(() =>
      defineCollection({ name: "1blog", fields: {} })
    ).toThrow("Collection name must be snake_case");
  });

  test("accepts valid snake_case names", () => {
    expect(() => defineCollection({ name: "blog_post", fields: {} })).not.toThrow();
    expect(() => defineCollection({ name: "article", fields: {} })).not.toThrow();
    expect(() => defineCollection({ name: "blog_post_v2", fields: {} })).not.toThrow();
  });
});

describe("defineConfig", () => {
  test("preserves CMS project configuration", () => {
    const blogPost = defineCollection({
      name: "blog_post",
      fields: {},
    });

    const config = defineConfig({
      site: { name: "Example", url: "https://example.com" },
      database: { provider: "sqlite", url: "data.db" },
      storage: { provider: "local", path: "./uploads" },
      auth: { methods: ["magic-link"] },
      collections: [blogPost],
    });

    expect(config.collections[0]?.name).toBe("blog_post");
    expect(config.database.url).toBe("data.db");
    expect(config.auth.methods).toContain("magic-link");
  });
});
