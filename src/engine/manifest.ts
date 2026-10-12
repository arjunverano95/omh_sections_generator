/**
 * The manifest the compiler emits as src/generated/sections/manifest.ts: what the active
 * template is made of, in a shape the seeder, the admin and tests can read without parsing
 * YAML again. Shared by the compiler (producer) and src/engine/seed (consumer).
 */

export const FIELD_TYPES = [
  'text',
  'textarea',
  'richText',
  'image',
  'icon',
  'link',
  'select',
  'number',
  'checkbox',
  'array',
  'form',
  'relation',
] as const
export type FieldType = (typeof FIELD_TYPES)[number]

export type FieldMeta = {
  name: string
  type: FieldType
  label: string
  required: boolean
  /** `select` only. */
  options?: { value: string; label: string }[]
  /** `relation` only. */
  to?: 'pages' | 'posts' | 'categories'
  /** `relation` only. */
  many?: boolean
  /** `array` only: the row's fields. */
  fields?: FieldMeta[]
  /** `array` only. */
  min?: number
  max?: number
}

export type SectionMeta = {
  /** The section's `name` from its file, e.g. `hero-split`. */
  name: string
  /** The block slug, e.g. `template-1-hero-split`. */
  slug: string
  /** The block's TypeScript interface name, e.g. `Template1HeroSplitBlock`. */
  interfaceName: string
  label: string
  fields: FieldMeta[]
}

export type GlobalName = 'header' | 'footer'

export type GlobalMeta = {
  name: GlobalName
  /** Always equals `name`; global slugs are not prefixed. */
  slug: GlobalName
  interfaceName: string
  fields: FieldMeta[]
}

export type Manifest = {
  /** Template folder name, e.g. `template-1`. */
  name: string
  label: string
  description?: string
  /** Block slugs in the order the admin lists them. */
  blocks: string[]
  globals: GlobalName[]
  /** Keyed by section name. */
  sections: Record<string, SectionMeta>
  globalMeta: Record<GlobalName, GlobalMeta>
}
