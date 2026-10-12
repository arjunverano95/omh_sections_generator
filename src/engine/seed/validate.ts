/**
 * Validates seed values against the compiled field metadata before anything is written.
 * Every problem is collected; the seeder throws one SeedValidationError listing all of them,
 * each naming the seed file, the page or global, the section and the field path.
 */
import { ICONS } from '@/engine/icons'
import type { FieldMeta } from '@/engine/manifest'

import { parseToken, type TokenKind } from './tokens'

export type SeedIssue = {
  /** Seed file name, e.g. `pages.yaml`. */
  file: string
  /** Where in the file: `page "home", section "hero-split" (sections[0])`. */
  where: string
  /** Dotted field path inside the section or global, e.g. `items[1].title`. */
  path: string
  message: string
}

export class SeedValidationError extends Error {
  readonly issues: SeedIssue[]

  constructor(issues: SeedIssue[]) {
    super(
      `Seed data is invalid (${issues.length} ${issues.length === 1 ? 'problem' : 'problems'}):\n` +
        issues.map(formatIssue).join('\n'),
    )
    this.name = 'SeedValidationError'
    this.issues = issues
  }
}

export function formatIssue(issue: SeedIssue): string {
  return `  ${issue.file}: ${issue.where}, field "${issue.path}": ${issue.message}`
}

type Location = Pick<SeedIssue, 'file' | 'where'>

const RELATION_TOKEN: Record<NonNullable<FieldMeta['to']>, TokenKind | null> = {
  pages: 'page',
  categories: 'category',
  posts: null,
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const join = (base: string, key: string | number): string =>
  typeof key === 'number' ? `${base}[${key}]` : base ? `${base}.${key}` : key

/** Validates one level of values (a section, a global or an array row) against its fields. */
export function validateValues(
  values: unknown,
  fields: FieldMeta[],
  location: Location,
  basePath = '',
): SeedIssue[] {
  const issues: SeedIssue[] = []
  const fail = (path: string, message: string) => issues.push({ ...location, path, message })

  if (values === null || values === undefined) values = {}
  if (!isPlainObject(values)) {
    fail(basePath || '(root)', `expected a map of field values, got ${describe(values)}`)
    return issues
  }

  const known = new Map(fields.map((field) => [field.name, field]))
  for (const key of Object.keys(values)) {
    if (!known.has(key)) {
      const names = fields.map((field) => field.name)
      fail(join(basePath, key), `not a field here; declared fields are ${names.map((n) => `"${n}"`).join(', ')}`)
    }
  }

  for (const field of fields) {
    const path = join(basePath, field.name)
    const value = values[field.name]
    if (value === undefined || value === null || value === '') {
      if (field.required) fail(path, 'is required')
      continue
    }
    validateValue(value, field, path, fail, location)
  }

  return issues

  function validateValue(
    value: unknown,
    field: FieldMeta,
    path: string,
    report: (path: string, message: string) => void,
    loc: Location,
  ): void {
    const expectToken = (kind: TokenKind, candidate: unknown, at: string) => {
      let token
      try {
        token = parseToken(candidate)
      } catch (error) {
        report(at, (error as Error).message)
        return
      }
      if (!token || token.kind !== kind) report(at, `expected a "@${kind}/<...>" reference, got ${describe(candidate)}`)
    }

    switch (field.type) {
      case 'text':
      case 'textarea':
      case 'richText':
        if (typeof value !== 'string') report(path, `expected text, got ${describe(value)}`)
        return
      case 'number':
        if (typeof value !== 'number' || Number.isNaN(value)) report(path, `expected a number, got ${describe(value)}`)
        else if (field.min !== undefined && value < field.min) report(path, `must be at least ${field.min}`)
        else if (field.max !== undefined && value > field.max) report(path, `must be at most ${field.max}`)
        return
      case 'checkbox':
        if (typeof value !== 'boolean') report(path, `expected true or false, got ${describe(value)}`)
        return
      case 'select': {
        const allowed = (field.options ?? []).map((option) => option.value)
        if (typeof value !== 'string' || !allowed.includes(value)) {
          report(path, `expected one of ${allowed.map((v) => `"${v}"`).join(', ')}, got ${describe(value)}`)
        }
        return
      }
      case 'icon':
        if (typeof value !== 'string' || !(value in ICONS)) {
          report(path, `${describe(value)} is not an icon name from src/engine/icons.ts`)
        }
        return
      case 'image':
        expectToken('media', value, path)
        return
      case 'form':
        expectToken('form', value, path)
        return
      case 'relation': {
        const kind = field.to ? RELATION_TOKEN[field.to] : null
        if (!kind) {
          report(path, `relations to "${field.to}" cannot be seeded; no reference token exists for them`)
          return
        }
        if (field.many) {
          if (!Array.isArray(value)) report(path, `expected a list of "@${kind}/<...>" references, got ${describe(value)}`)
          else value.forEach((item, index) => expectToken(kind, item, join(path, index)))
        } else {
          expectToken(kind, value, path)
        }
        return
      }
      case 'link':
        validateLink(value, path, report, expectToken)
        return
      case 'array': {
        if (!Array.isArray(value)) {
          report(path, `expected a list of rows, got ${describe(value)}`)
          return
        }
        if (field.min !== undefined && value.length < field.min) report(path, `needs at least ${field.min} rows, has ${value.length}`)
        if (field.max !== undefined && value.length > field.max) report(path, `allows at most ${field.max} rows, has ${value.length}`)
        value.forEach((row, index) => {
          issues.push(...validateValues(row, field.fields ?? [], loc, join(path, index)))
        })
        return
      }
    }
  }
}

const LINK_KEYS = new Set(['type', 'reference', 'url', 'label', 'newTab'])

function validateLink(
  value: unknown,
  path: string,
  report: (path: string, message: string) => void,
  expectToken: (kind: TokenKind, candidate: unknown, at: string) => void,
): void {
  if (!isPlainObject(value)) {
    report(path, `expected a link { type, reference | url, label, newTab? }, got ${describe(value)}`)
    return
  }
  for (const key of Object.keys(value)) {
    if (!LINK_KEYS.has(key)) report(join(path, key), 'not a link property; use type, reference, url, label or newTab')
  }
  if (value.type !== 'reference' && value.type !== 'custom') {
    report(join(path, 'type'), `expected "reference" or "custom", got ${describe(value.type)}`)
  } else if (value.type === 'reference') {
    expectToken('page', value.reference, join(path, 'reference'))
  } else if (typeof value.url !== 'string' || value.url === '') {
    report(join(path, 'url'), 'is required for a custom link')
  }
  if (typeof value.label !== 'string' || value.label === '') report(join(path, 'label'), 'is required')
  if (value.newTab !== undefined && typeof value.newTab !== 'boolean') {
    report(join(path, 'newTab'), `expected true or false, got ${describe(value.newTab)}`)
  }
}

function describe(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'a list'
  if (typeof value === 'object') return 'a map'
  if (typeof value === 'string') return `"${value}"`
  return String(value)
}
