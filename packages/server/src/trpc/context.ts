import type { AppDatabase } from "@not-a-cms/core"
import { initTRPC, TRPCError } from "@trpc/server"

export type AppContext = {
  db: AppDatabase
  session: { userId: string; role: string } | null
}

const t = initTRPC.context<AppContext>().create()

export const router = t.router
export const publicProcedure = t.procedure
export const createCallerFactory = t.createCallerFactory

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" })
  }
  return next({ ctx: { ...ctx, session: ctx.session } })
})
