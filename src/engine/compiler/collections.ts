/**
 * What the compiler knows about the documents a reference can reach: the project's
 * collections (for `list` rows and `relation` fields), the `link` group and the Media
 * document. Dot paths are checked against these tables (template-format.md section 6.2).
 */

import type { FieldType } from '../manifest'
import type { ListCollection } from '../render/types'
import type { PathSegment } from './errors'

export type ScopeFieldType = FieldType | 'date' | 'url' | 'group'

export type ScopeField = {
  type: ScopeFieldType
  /** `select`: normalised options. */
  options?: { value: string; label: string }[]
  /** `array` rows and `group`s. */
  fields?: Record<string, ScopeField>
  /** `relation`. */
  to?: ListCollection
  many?: boolean
  /** Template-declared fields carry their document path, for warnings. */
  path?: PathSegment[]
}

const text: ScopeField = { type: 'text' }
const textarea: ScopeField = { type: 'textarea' }
const date: ScopeField = { type: 'date' }
const image: ScopeField = { type: 'image' }
const url: ScopeField = { type: 'url' }

const meta: ScopeField = {
  type: 'group',
  fields: { title: text, description: textarea, image },
}

const timestamps = { createdAt: date, updatedAt: date }

/** Fields a `list` row or a populated `relation` exposes, plus the synthetic `url`. */
export const COLLECTION_FIELDS: Record<ListCollection, Record<string, ScopeField>> = {
  posts: {
    title: text,
    slug: text,
    publishedAt: date,
    heroImage: image,
    content: { type: 'richText' },
    categories: { type: 'relation', to: 'categories', many: true },
    populatedAuthors: { type: 'array', fields: { name: text } },
    meta,
    ...timestamps,
    url,
  },
  pages: {
    title: text,
    slug: text,
    publishedAt: date,
    meta,
    ...timestamps,
    url,
  },
  categories: {
    title: text,
    slug: text,
    ...timestamps,
    url,
  },
}

/** Fields a `list.sort` may name (top-level, stored, not synthetic). */
export function sortableFields(collection: ListCollection): string[] {
  return Object.entries(COLLECTION_FIELDS[collection])
    .filter(([, field]) => !['url', 'group', 'array', 'relation', 'image', 'richText'].includes(field.type))
    .map(([name]) => name)
}

/** The `link()` group: what `cta.label` and friends resolve to. */
export const LINK_FIELDS: Record<string, ScopeField> = {
  label: text,
  url: text,
  newTab: { type: 'checkbox' },
  type: {
    type: 'select',
    options: [
      { value: 'reference', label: 'Internal link' },
      { value: 'custom', label: 'Custom URL' },
    ],
  },
}

/** The Media document behind an `image` field. */
export const MEDIA_FIELDS: Record<string, ScopeField> = {
  alt: text,
  caption: { type: 'richText' },
  url: text,
  filename: text,
  mimeType: text,
  width: { type: 'number' },
  height: { type: 'number' },
}

/** Field types each reference-taking primitive accepts (template-format.md section 6.1). */
export const PRIMITIVE_ACCEPTS: Record<
  'text' | 'richText' | 'image' | 'icon' | 'button' | 'each' | 'form',
  readonly ScopeFieldType[]
> = {
  text: ['text', 'textarea', 'select', 'number', 'date'],
  richText: ['richText'],
  image: ['image'],
  icon: ['icon'],
  button: ['link'],
  each: ['array'],
  form: ['form'],
}

/** What a literal button's `href` reference may point at. */
export const HREF_ACCEPTS: readonly ScopeFieldType[] = ['text', 'url']

/** The properties reachable through a dot from a field of this type, or `undefined`. */
export function childFields(field: ScopeField): Record<string, ScopeField> | undefined {
  switch (field.type) {
    case 'link':
      return LINK_FIELDS
    case 'image':
      return MEDIA_FIELDS
    case 'group':
      return field.fields
    case 'relation':
      return field.many || !field.to ? undefined : COLLECTION_FIELDS[field.to]
    default:
      return undefined
  }
}

export function describeType(field: ScopeField): string {
  if (field.type === 'relation') return `relation to ${field.to}${field.many ? ' (many)' : ''}`
  return field.type
}
