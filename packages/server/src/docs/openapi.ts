import type { CollectionDef, FieldDef } from "@not-a-cms/core"

type OpenAPISchema = Record<string, unknown>

export function createOpenAPIDocument(collections: CollectionDef[]) {
  const schemas: Record<string, OpenAPISchema> = {}
  const paths: Record<string, OpenAPISchema> = {
    "/health": {
      get: {
        summary: "Health check",
        responses: {
          "200": { description: "Server is healthy" },
        },
      },
    },
    "/graphql": {
      post: {
        summary: "GraphQL endpoint",
        requestBody: jsonRequestBody({ type: "object", additionalProperties: true }),
        responses: {
          "200": { description: "GraphQL response" },
        },
      },
    },
    "/trpc/{path}": {
      get: {
        summary: "tRPC query endpoint",
        parameters: [pathParam("path", "tRPC procedure path")],
        responses: standardReadResponses(),
      },
      post: {
        summary: "tRPC mutation endpoint",
        parameters: [pathParam("path", "tRPC procedure path")],
        security: [{ cookieAuth: [] }],
        responses: standardWriteResponses(),
      },
    },
  }

  for (const collection of collections) {
    const schemaName = collectionToSchemaName(collection.name)
    schemas[schemaName] = collectionSchema(collection)

    paths[`/api/${collection.name}`] = {
      get: {
        summary: `List ${collection.labels.plural}`,
        ...(requiresReadAuth(collection) ? { security: [{ cookieAuth: [] }] } : {}),
        parameters: [
          queryParam("limit", "Maximum number of documents to return", { type: "integer" }),
          queryParam("offset", "Number of documents to skip", { type: "integer" }),
          queryParam("where", "JSON encoded where filter", { type: "string" }),
        ],
        responses: {
          "200": {
            description: "Collection list",
            content: jsonContent({
              type: "object",
              properties: {
                data: { type: "array", items: { $ref: `#/components/schemas/${schemaName}` } },
                total: { type: "integer" },
                limit: { type: ["integer", "null"] },
                offset: { type: "integer" },
              },
            }),
          },
          ...standardErrorRefs(),
        },
      },
      post: {
        summary: `Create ${collection.labels.singular}`,
        security: [{ cookieAuth: [] }],
        requestBody: jsonRequestBody({ $ref: `#/components/schemas/${schemaName}` }),
        responses: standardWriteResponses(schemaName),
      },
    }

    paths[`/api/${collection.name}/{id}`] = {
      get: {
        summary: `Get ${collection.labels.singular}`,
        ...(requiresReadAuth(collection) ? { security: [{ cookieAuth: [] }] } : {}),
        parameters: [pathParam("id", "Document ID")],
        responses: standardReadResponses(schemaName),
      },
      patch: {
        summary: `Update ${collection.labels.singular}`,
        security: [{ cookieAuth: [] }],
        parameters: [pathParam("id", "Document ID")],
        requestBody: jsonRequestBody({ $ref: `#/components/schemas/${schemaName}` }),
        responses: standardWriteResponses(schemaName),
      },
      delete: {
        summary: `Delete ${collection.labels.singular}`,
        security: [{ cookieAuth: [] }],
        parameters: [pathParam("id", "Document ID")],
        responses: {
          "200": {
            description: "Deleted",
            content: jsonContent({
              type: "object",
              properties: { deleted: { type: "boolean" } },
            }),
          },
          ...standardErrorRefs(),
        },
      },
    }
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "not-a-cms API",
      version: "0.0.1",
    },
    paths,
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "better-auth.session_token",
        },
      },
      schemas,
      responses: {
        Unauthorized: errorResponse("Sign in to continue."),
        Forbidden: errorResponse("You do not have permission to perform this action."),
        NotFound: errorResponse("Resource not found."),
        ValidationError: errorResponse("Validation failed."),
      },
    },
  }
}

function collectionSchema(collection: CollectionDef): OpenAPISchema {
  const properties: Record<string, OpenAPISchema> = {
    id: { type: "string" },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
  }
  const required: string[] = []

  for (const [fieldName, fieldDef] of Object.entries(collection.fields)) {
    properties[fieldName] = fieldSchema(fieldDef)
    if (fieldDef.required) required.push(fieldName)
  }

  return {
    type: "object",
    required,
    properties,
    additionalProperties: false,
  }
}

function fieldSchema(fieldDef: FieldDef): OpenAPISchema {
  switch (fieldDef.type) {
    case "number":
      return { type: "integer" }
    case "boolean":
      return { type: "boolean" }
    case "datetime":
      return { type: "string", format: "date-time" }
    case "select":
      return { type: "string", enum: fieldDef.options }
    case "richText":
      return { type: "array", items: { type: "object", additionalProperties: true } }
    case "array":
      return { type: "array", items: fieldSchema(fieldDef.items) }
    case "group":
      return {
        type: "object",
        properties: Object.fromEntries(
          Object.entries(fieldDef.fields).map(([name, def]) => [name, fieldSchema(def)]),
        ),
        additionalProperties: false,
      }
    case "pageLayout":
      return { type: "object", additionalProperties: true }
    default:
      return { type: "string" }
  }
}

function collectionToSchemaName(name: string): string {
  return name
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")
}

function requiresReadAuth(collection: CollectionDef): boolean {
  return collection.access?.read !== undefined
}

function standardReadResponses(schemaName?: string): OpenAPISchema {
  return {
    "200": schemaName
      ? {
          description: "Document",
          content: jsonContent({ $ref: `#/components/schemas/${schemaName}` }),
        }
      : { description: "Successful response" },
    ...standardErrorRefs(),
  }
}

function standardWriteResponses(schemaName?: string): OpenAPISchema {
  return {
    "200": schemaName
      ? {
          description: "Document",
          content: jsonContent({ $ref: `#/components/schemas/${schemaName}` }),
        }
      : { description: "Successful response" },
    ...standardErrorRefs(),
  }
}

function standardErrorRefs(): OpenAPISchema {
  return {
    "400": { $ref: "#/components/responses/ValidationError" },
    "401": { $ref: "#/components/responses/Unauthorized" },
    "403": { $ref: "#/components/responses/Forbidden" },
    "404": { $ref: "#/components/responses/NotFound" },
  }
}

function errorResponse(message: string): OpenAPISchema {
  return {
    description: message,
    content: jsonContent({
      type: "object",
      properties: {
        error: { type: "string", example: message },
      },
    }),
  }
}

function jsonContent(schema: OpenAPISchema): OpenAPISchema {
  return {
    "application/json": { schema },
  }
}

function jsonRequestBody(schema: OpenAPISchema): OpenAPISchema {
  return {
    required: true,
    content: jsonContent(schema),
  }
}

function pathParam(name: string, description: string): OpenAPISchema {
  return {
    name,
    in: "path",
    required: true,
    description,
    schema: { type: "string" },
  }
}

function queryParam(name: string, description: string, schema: OpenAPISchema): OpenAPISchema {
  return {
    name,
    in: "query",
    required: false,
    description,
    schema,
  }
}
