const reported = new Set<string>()

/**
 * A plan that does not match the code it was compiled for (a node type or block slug with no
 * renderer) is a programming error: it throws in development, and in production renders
 * nothing and logs each distinct message once.
 */
export function reportPlanError(message: string): void {
  if (process.env.NODE_ENV !== 'production') throw new Error(message)
  if (reported.has(message)) return
  reported.add(message)
  console.error(`[sections] ${message}`)
}
