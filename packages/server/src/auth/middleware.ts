export async function getSessionFromRequest(
  auth: any, // Better Auth instance
  req: Request,
  options: {
    getRoleForUser?: (user: {
      id: string
      email?: string | null
      role?: string
    }) => string | null | Promise<string | null>
  } = {},
): Promise<{ userId: string; email?: string | null; role: string } | null> {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user) return null
    const user = session.user as { id: string; email?: string | null; role?: string }
    const assignedRole = await options.getRoleForUser?.(user)
    return {
      userId: user.id,
      email: user.email ?? null,
      role: assignedRole ?? user.role ?? "viewer",
    }
  } catch {
    return null
  }
}
