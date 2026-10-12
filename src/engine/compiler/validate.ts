/**
 * The schema pass: zod issues become diagnostics with a source position, a document path
 * and a message written for the template author rather than for a programmer.
 */

import type { z } from 'zod'

import { FIELD_TYPES } from '../manifest'
import { didYouMean, pathToString, type Diagnostics, type PathSegment } from './errors'
import type { LoadedFile } from './load'

type Issue = z.core.$ZodIssue

/** Zod's own wording starts like this; anything else is a message a schema set on purpose. */
const DEFAULT_MESSAGE_RE = /^(Invalid |Too (small|big)|Unrecognized key|Expected |Input not instance)/

function isCustomMessage(message: string): boolean {
  return !DEFAULT_MESSAGE_RE.test(message)
}

function describeValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'nothing'
  if (Array.isArray(value)) return 'a list'
  if (typeof value === 'object') return 'a map'
  if (typeof value === 'string') return `the string "${value}"`
  return `${typeof value} ${String(value)}`
}

function lastKey(path: readonly PathSegment[]): string {
  const last = path[path.length - 1]
  return last === undefined ? 'the document' : `"${String(last)}"`
}

/**
 * Walks the schema along a document path and returns the object keys that are valid there,
 * so an unknown key can get a "Did you mean" hint. Best effort: `undefined` when the path
 * cannot be followed.
 */
type AnySchema = { _zod: { def: { type: string } & Record<string, unknown> } }

function unwrap(schema: AnySchema): AnySchema[] {
  const def = schema._zod.def
  switch (def.type) {
    case 'lazy':
      return unwrap((def.getter as () => AnySchema)())
    case 'optional':
    case 'nullable':
    case 'default':
    case 'nonoptional':
    case 'readonly':
    case 'catch':
    case 'prefault':
      return unwrap(def.innerType as AnySchema)
    case 'pipe':
      return unwrap(def.in as AnySchema)
    case 'union':
      return (def.options as AnySchema[]).flatMap(unwrap)
    default:
      return [schema]
  }
}

function descend(schemas: AnySchema[], segment: PathSegment): AnySchema[] {
  const out: AnySchema[] = []
  for (const schema of schemas) {
    const def = schema._zod.def
    if (def.type === 'object') {
      const shape = def.shape as Record<string, AnySchema>
      const next = shape[String(segment)]
      if (next) out.push(...unwrap(next))
    } else if (def.type === 'array' && typeof segment === 'number') {
      out.push(...unwrap(def.element as AnySchema))
    } else if (def.type === 'record') {
      out.push(...unwrap(def.valueType as AnySchema))
    }
  }
  return out
}

export function candidateKeys(root: z.ZodType, path: readonly PathSegment[]): string[] | undefined {
  let schemas = unwrap(root as unknown as AnySchema)
  for (const segment of path) {
    schemas = descend(schemas, segment)
    if (schemas.length === 0) return undefined
  }
  const keys = new Set<string>()
  for (const schema of schemas) {
    if (schema._zod.def.type === 'object') {
      for (const key of Object.keys(schema._zod.def.shape as Record<string, unknown>)) keys.add(key)
    }
  }
  return keys.size ? [...keys] : undefined
}

/** When every branch of a union fails, the branch that got furthest is the one the author meant. */
function pickBranch(errors: Issue[][]): Issue[] {
  const score = (issues: Issue[]) => ({
    rootTypeOnly: issues.every((i) => i.path.length === 0 && i.code === 'invalid_type'),
    depth: Math.max(0, ...issues.map((i) => i.path.length)),
    count: issues.length,
  })
  return [...errors].sort((a, b) => {
    const sa = score(a)
    const sb = score(b)
    if (sa.rootTypeOnly !== sb.rootTypeOnly) return sa.rootTypeOnly ? 1 : -1
    if (sa.depth !== sb.depth) return sb.depth - sa.depth
    return sa.count - sb.count
  })[0]!
}

type Report = { path: PathSegment[]; message: string; hint?: string; key?: boolean }

function reportIssue(issue: Issue, prefix: PathSegment[], root: z.ZodType, out: Report[]): void {
  const path = [...prefix, ...(issue.path as PathSegment[])]
  const input = (issue as { input?: unknown }).input

  switch (issue.code) {
    case 'invalid_union': {
      const union = issue as z.core.$ZodIssueInvalidUnion & { discriminator?: string }
      if (union.errors.length === 0) {
        const discriminator = union.discriminator ?? 'type'
        const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : undefined
        const given = record?.[discriminator]
        if (given === undefined) {
          out.push({
            path,
            message: `"${discriminator}" is missing; a field is written name: type or name: { type, ...options }`,
          })
        } else {
          out.push({
            path: [...path, discriminator],
            message: `"${String(given)}" is not a field type; the types are ${FIELD_TYPES.join(', ')}`,
            hint: typeof given === 'string' ? didYouMean(given, FIELD_TYPES) : undefined,
          })
        }
        return
      }
      for (const sub of pickBranch(union.errors)) reportIssue(sub, path, root, out)
      return
    }
    case 'unrecognized_keys': {
      const candidates = candidateKeys(root, path)
      for (const key of (issue as z.core.$ZodIssueUnrecognizedKeys).keys) {
        out.push({
          path: [...path, key],
          key: true,
          message: `"${key}" is not a key ${path.length ? `of ${lastKey(path)}` : 'of this file'}${candidates ? `; the keys are ${candidates.join(', ')}` : ''}`,
          hint: candidates ? didYouMean(key, candidates) : undefined,
        })
      }
      return
    }
    case 'invalid_type': {
      const custom = isCustomMessage(issue.message)
      if (input === undefined) {
        out.push({ path, message: `${lastKey(path)} is required`, hint: custom ? issue.message : undefined })
      } else if (custom) {
        out.push({ path, message: issue.message })
      } else {
        const expected = (issue as z.core.$ZodIssueInvalidType).expected
        out.push({ path, message: `${lastKey(path)} must be ${expected === 'object' ? 'a map' : expected === 'array' ? 'a list' : `a ${expected}`}, not ${describeValue(input)}` })
      }
      return
    }
    case 'invalid_value': {
      const values = (issue as z.core.$ZodIssueInvalidValue).values.map(String)
      const custom = isCustomMessage(issue.message)
      out.push({
        path,
        message: custom
          ? issue.message
          : `${describeValue(input)} is not allowed for ${lastKey(path)}; use one of ${values.join(', ')}`,
        hint: typeof input === 'string' ? didYouMean(input, values) : undefined,
      })
      return
    }
    case 'invalid_key': {
      const sub = (issue as z.core.$ZodIssueInvalidKey).issues[0]
      out.push({ path, key: true, message: `${sub?.message ?? issue.message} (key "${String(input)}")` })
      return
    }
    case 'too_small': {
      const small = issue as z.core.$ZodIssueTooSmall
      if (!isCustomMessage(issue.message) && small.origin === 'string' && small.minimum === 1) {
        out.push({ path, message: `${lastKey(path)} must not be empty` })
        return
      }
      out.push({ path, message: issue.message })
      return
    }
    default:
      out.push({ path, message: issue.message })
  }
}

/**
 * Validates one loaded file. Every issue becomes a diagnostic; the parsed value is returned
 * only when there were none.
 */
export function validateFile<T>(schema: z.ZodType<T>, file: LoadedFile, diagnostics: Diagnostics): T | undefined {
  const result = schema.safeParse(file.data, { reportInput: true })
  if (result.success) return result.data

  const reports: Report[] = []
  for (const issue of result.error.issues) reportIssue(issue, [], schema, reports)
  for (const report of reports) {
    diagnostics.error({
      file: file.file,
      position: file.positionOf(report.path, { key: report.key }),
      path: pathToString(report.path),
      message: report.message,
      hint: report.hint,
    })
  }
  return undefined
}
