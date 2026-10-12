import type { Condition, Scope, ScopeObject } from './types'

/**
 * A reference or condition as the resolver reads it. `depth` is the index into the scope
 * chain (0 = innermost) that declares `path[0]`; the compiler emits it on every reference.
 */
type Located = { path: string[]; depth?: number }

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The scope that owns `path[0]`: `scope[depth]` when known, else the innermost scope with the key. */
function owner(ref: Located, scope: Scope): ScopeObject | undefined {
  if (ref.depth !== undefined) return scope[ref.depth]
  const [head] = ref.path
  return scope.find((object) => Object.hasOwn(object, head))
}

/** Follows `ref.path` from its owning scope. A missing step yields `undefined`. */
export function resolve(ref: Located, scope: Scope): unknown {
  let value: unknown = owner(ref, scope)
  for (const segment of ref.path) {
    if (!isObject(value)) return undefined
    value = value[segment]
  }
  return value
}

/**
 * Empty means absent: `undefined`, `null`, `''`, `[]`. Unpopulated relations are judged by the
 * primitive that expects a document, because only it knows an id is not enough.
 */
export function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  )
}

/** A populated relation or upload: an object, not a bare id. */
export function isDocument(value: unknown): value is Record<string, unknown> {
  return isObject(value)
}

export function truthy(value: unknown): boolean {
  return !isEmpty(value) && Boolean(value)
}

/** `if:` — strict equality for `equals`, strict inequality for `not`, truthiness otherwise. */
export function test(condition: Condition & Located, scope: Scope): boolean {
  const value = resolve(condition, scope)
  if ('equals' in condition) return value === condition.equals
  if ('not' in condition) return value !== condition.not
  return truthy(value)
}
