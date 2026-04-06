import { createYoga } from "graphql-yoga"
import type { GraphQLSchema } from "graphql"

export function createGraphQLHandler(schema: GraphQLSchema) {
  const yoga = createYoga({
    schema,
    graphqlEndpoint: "/graphql",
  })

  return async function handler(req: Request): Promise<Response> {
    return yoga.fetch(req)
  }
}
