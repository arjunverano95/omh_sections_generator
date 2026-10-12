/**
 * The manifest the compiler emits as src/generated/sections/manifest.ts: what the site is
 * made of, in a shape the seeder, the admin and tests can read without parsing YAML again.
 * Shared by the compiler (producer) and src/engine/seed (consumer).
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
  /** The block slug: the section name, e.g. `hero-split`. */
  slug: string
  /** The block's TypeScript interface name, e.g. `HeroSplitBlock`. */
  interfaceName: string
  label: string
  fields: FieldMeta[]
}

export type GlobalName = 'header' | 'footer'

export type GlobalMeta = {
  name: GlobalName
  /** Always equals `name`. */
  slug: GlobalName
  interfaceName: string
  fields: FieldMeta[]
}

/** `colorMode` from theme.yaml: the palette every visitor gets, or `system` for the device setting. */
export const COLOR_MODES = ['light', 'dark', 'system'] as const
export type ColorMode = (typeof COLOR_MODES)[number]

export type Manifest = {
  /** `siteName` from theme.yaml: the title suffix in page metadata and the seed button's label. */
  siteName: string
  /** `colorMode` from theme.yaml, `system` when the file leaves it out. */
  colorMode: ColorMode
  /** Block slugs in the order the admin lists them. */
  blocks: string[]
  globals: GlobalName[]
  /** Keyed by section name. */
  sections: Record<string, SectionMeta>
  globalMeta: Record<GlobalName, GlobalMeta>
}
