/**
 * Turns validated seed values into Payload data: tokens become document ids, links become
 * the `link()` group shape, Markdown becomes Lexical. Pure apart from the lookups it is
 * given, so it is tested without a database.
 */
import type { FieldMeta } from '@/engine/manifest'

import { parseToken, type TokenKind } from './tokens'

export type DocumentId = number | string

export type ResolveContext = {
  /** Id of an uploaded media file, by file name. */
  media: (file: string) => DocumentId
  /** Id of a page, by slug. */
  page: (slug: string) => DocumentId
  form: (key: string) => DocumentId
  category: (slug: string) => DocumentId
  /**
   * Markdown to Lexical for one richText field. `fieldPath` is the field's name path
   * inside its section or global, array rows included by name: `['rows', 'body']`.
   */
  richText: (markdown: string, fieldPath: string[]) => unknown
}

export function resolveToken(value: unknown, expected: TokenKind, context: ResolveContext): DocumentId {
  const token = parseToken(value)
  if (!token || token.kind !== expected) {
    throw new Error(`expected a "@${expected}/<...>" reference, got ${JSON.stringify(value)}`)
  }
  return context[token.kind](token.key)
}

export type SeedLink = {
  type: 'reference' | 'custom'
  reference?: string
  url?: string
  label: string
  newTab?: boolean
}

/** The `link()` group's stored shape. Internal links always point at pages. */
export function resolveLink(link: SeedLink, context: ResolveContext): Record<string, unknown> {
  const resolved: Record<string, unknown> = { type: link.type, label: link.label, newTab: link.newTab ?? false }
  if (link.type === 'reference') {
    resolved.reference = { relationTo: 'pages', value: resolveToken(link.reference, 'page', context) }
  } else {
    resolved.url = link.url
  }
  return resolved
}

/** Resolves one level of values (section, global or array row). Unset fields are left out. */
export function resolveValues(
  values: Record<string, unknown> | null | undefined,
  fields: FieldMeta[],
  context: ResolveContext,
  parentPath: string[] = [],
): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  if (!values) return data

  for (const field of fields) {
    const value = values[field.name]
    if (value === undefined || value === null || value === '') continue
    const fieldPath = [...parentPath, field.name]

    switch (field.type) {
      case 'image':
        data[field.name] = resolveToken(value, 'media', context)
        break
      case 'form':
        data[field.name] = resolveToken(value, 'form', context)
        break
      case 'relation': {
        const kind: TokenKind = field.to === 'categories' ? 'category' : 'page'
        data[field.name] = field.many
          ? (value as unknown[]).map((item) => resolveToken(item, kind, context))
          : resolveToken(value, kind, context)
        break
      }
      case 'link':
        data[field.name] = resolveLink(value as SeedLink, context)
        break
      case 'richText':
        data[field.name] = context.richText(value as string, fieldPath)
        break
      case 'array':
        data[field.name] = (value as Record<string, unknown>[]).map((row) =>
          resolveValues(row, field.fields ?? [], context, fieldPath),
        )
        break
      default:
        data[field.name] = value
    }
  }

  return data
}
