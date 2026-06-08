import type { GraphQLSchema } from "graphql"
import { createYoga } from "graphql-yoga"
import type { GraphQLContext } from "./schema"

type GraphQLHandlerOptions = {
  getRole?: (req: Request) => string | null | Promise<string | null>
}

export function createGraphQLHandler(schema: GraphQLSchema, options: GraphQLHandlerOptions = {}) {
  const yoga = createYoga({
    schema,
    graphqlEndpoint: "/graphql",
    context: async ({ request }): Promise<GraphQLContext> => ({
      role: (await options.getRole?.(request)) ?? "viewer",
    }),
  })

  return async function handler(req: Request): Promise<Response> {
    return yoga.fetch(req)
  }
}
