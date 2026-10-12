/**
 * Short forms to long forms, defaults filled, one internal model for the emitters.
 */

import path from 'node:path'

import type { ColorMode, FieldType, Manifest } from '../manifest'
import type { Plan } from '../render/types'
import type {
  FieldDef,
  FieldsRecord,
  FontSpec,
  GlobalFile,
  LayoutNode,
  LongFormField,
  SectionFile,
  ThemeFile,
} from '../schema'
import { COLOR_SLOTS, toKebabCase, toLabel, toPascalCase, type ColorSlot } from '../schema/common'
import type { ScopeField } from './collections'
import type { Diagnostics, PathSegment } from './errors'
import type { LoadedFile } from './load'

export type NField = {
  name: string
  type: FieldType
  label: string
  required: boolean
  default?: unknown
  help?: string
  maxLength?: number
  options?: { value: string; label: string }[]
  min?: number
  max?: number
  fields?: NField[]
  rowLabel?: string
  to?: 'pages' | 'posts' | 'categories'
  many?: boolean
}

export type NPreview = {
  /** Absolute path of the source image. */
  source: string
  /** Path under `public/`, which is also the URL. */
  publicPath: string
}

export type NSection = {
  kind: 'section'
  name: string
  slug: string
  interfaceName: string
  label: string
  plural: string
  description?: string
  group: string
  preview?: NPreview
  fields: NField[]
  layout: LayoutNode[]
  file: LoadedFile
}

export type NGlobal = {
  kind: 'global'
  name: 'header' | 'footer'
  slug: 'header' | 'footer'
  interfaceName: string
  label: string
  fields: NField[]
  layout: LayoutNode[]
  file: LoadedFile
}

export type NFont = {
  family: string
  /** `Playfair_Display`: the `next/font/google` export. */
  importName: string
  /** `--font-playfair-display` */
  variable: string
  weights?: string[]
  subsets: string[]
}

export type NTheme = {
  siteName: string
  colorMode: ColorMode
  fonts: { sans: NFont; heading: NFont }
  colors: { light: Partial<Record<ColorSlot, string>>; dark: Partial<Record<ColorSlot, string>> }
  radius?: string
  variants: Record<string, Record<string, string>>
  file: LoadedFile
}

export type NormalisedSite = {
  /** Absolute path of the templates folder. */
  dir: string
  theme: NTheme
  globals: { header: NGlobal; footer: NGlobal }
  sections: NSection[]
  /** Filled by the resolver: one plan per block slug and global slug. */
  plans: Record<string, Plan>
  manifest: Manifest
}

export function normaliseFont(spec: FontSpec): NFont {
  const family = typeof spec === 'string' ? spec : spec.family
  const trimmed = family.trim().replace(/\s+/g, ' ')
  return {
    family: trimmed,
    importName: trimmed.replace(/ /g, '_'),
    variable: `--font-${toKebabCase(trimmed)}`,
    weights: typeof spec === 'string' || !spec.weights ? undefined : spec.weights.map(String),
    subsets: typeof spec === 'string' || !spec.subsets ? ['latin'] : spec.subsets,
  }
}

export function normaliseTheme(theme: ThemeFile, file: LoadedFile): NTheme {
  const sans = normaliseFont(theme.fonts.sans)
  const heading = theme.fonts.heading ? normaliseFont(theme.fonts.heading) : sans
  const pick = (set: Partial<Record<ColorSlot, string>> | undefined) => {
    const out: Partial<Record<ColorSlot, string>> = {}
    if (!set) return out
    for (const slot of COLOR_SLOTS) {
      const value = set[slot]
      if (value) out[slot] = value.trim()
    }
    return out
  }
  return {
    siteName: theme.siteName.trim(),
    colorMode: theme.colorMode ?? 'system',
    fonts: { sans, heading },
    colors: { light: pick(theme.colors.light), dark: pick(theme.colors.dark) },
    radius: theme.radius,
    variants: theme.variants ?? {},
    file,
  }
}

function checkDefault(field: NField, docPath: PathSegment[], file: LoadedFile, diagnostics: Diagnostics): void {
  if (field.default === undefined) return
  const value = field.default
  const expect = (ok: boolean, wanted: string) => {
    if (ok) return
    diagnostics.error({
      file: file.file,
      position: file.positionOf([...docPath, 'default']),
      path: [...docPath, 'default'].map(String).join('.'),
      message: `default for a ${field.type} field is ${wanted}`,
    })
  }
  switch (field.type) {
    case 'text':
    case 'textarea':
      expect(typeof value === 'string', 'a string')
      break
    case 'number':
      expect(typeof value === 'number', 'a number')
      break
    case 'checkbox':
      expect(typeof value === 'boolean', 'true or false')
      break
    case 'select':
      expect(
        (typeof value === 'string' || typeof value === 'number') &&
          (field.options ?? []).some((o) => o.value === String(value)),
        `one of the options (${(field.options ?? []).map((o) => o.value).join(', ')})`,
      )
      break
    case 'icon':
      expect(typeof value === 'string', 'an icon name')
      break
    default:
      expect(false, 'not supported; seed the value instead')
  }
}

export function normaliseFields(
  fields: FieldsRecord,
  file: LoadedFile,
  diagnostics: Diagnostics,
  docPath: PathSegment[] = ['fields'],
): NField[] {
  return Object.entries(fields).map(([name, def]) => normaliseField(name, def, file, diagnostics, [...docPath, name]))
}

function normaliseField(
  name: string,
  def: FieldDef,
  file: LoadedFile,
  diagnostics: Diagnostics,
  docPath: PathSegment[],
): NField {
  // The shorthand form is only allowed for types with nothing mandatory beside `type`.
  const long: LongFormField = typeof def === 'string' ? ({ type: def } as LongFormField) : def
  const field: NField = {
    name,
    type: long.type,
    label: long.label ?? toLabel(name),
    required: long.required ?? false,
  }
  if (long.default !== undefined) field.default = long.default
  if (long.help) field.help = long.help

  switch (long.type) {
    case 'text':
    case 'textarea':
      if (long.maxLength !== undefined) field.maxLength = long.maxLength
      break
    case 'select':
      field.options = long.options.map((option) =>
        typeof option === 'object'
          ? { value: String(option.value), label: option.label }
          : { value: String(option), label: String(option) },
      )
      if (field.default !== undefined) field.default = String(field.default)
      break
    case 'number':
      if (long.min !== undefined) field.min = long.min
      if (long.max !== undefined) field.max = long.max
      break
    case 'array':
      if (long.min !== undefined) field.min = long.min
      if (long.max !== undefined) field.max = long.max
      field.fields = normaliseFields(long.fields, file, diagnostics, [...docPath, 'fields'])
      if (long.rowLabel !== undefined) {
        field.rowLabel = long.rowLabel
        if (!field.fields.some((f) => f.name === long.rowLabel)) {
          diagnostics.error({
            file: file.file,
            position: file.positionOf([...docPath, 'rowLabel']),
            path: [...docPath, 'rowLabel'].map(String).join('.'),
            message: `rowLabel "${long.rowLabel}" is not a field of the row; the row's fields are ${field.fields.map((f) => f.name).join(', ')}`,
          })
        }
      }
      break
    case 'relation':
      field.to = long.to
      if (long.many !== undefined) field.many = long.many
      break
    default:
      break
  }

  checkDefault(field, docPath, file, diagnostics)
  return field
}

/** The resolver's view of declared fields, with the document path of each for warnings. */
export function toScopeFields(fields: NField[], docPath: PathSegment[] = ['fields']): Record<string, ScopeField> {
  const out: Record<string, ScopeField> = {}
  for (const field of fields) {
    const own: PathSegment[] = [...docPath, field.name]
    const scopeField: ScopeField = { type: field.type, path: own }
    if (field.options) scopeField.options = field.options
    if (field.fields) scopeField.fields = toScopeFields(field.fields, [...own, 'fields'])
    if (field.to) scopeField.to = field.to
    if (field.many) scopeField.many = field.many
    out[field.name] = scopeField
  }
  return out
}

/** The default `plural`: good enough for block counts; a section sets `plural` for the rest. */
export function pluralise(label: string): string {
  if (/s$/i.test(label)) return label
  if (/[^aeiou]y$/i.test(label)) return `${label.slice(0, -1)}ies`
  if (/(x|z|ch|sh)$/i.test(label)) return `${label}es`
  return `${label}s`
}

/** The block drawer group of a section that sets none. */
export const DEFAULT_GROUP = 'Sections'

export function normaliseSection(doc: SectionFile, file: LoadedFile, diagnostics: Diagnostics): NSection {
  let preview: NPreview | undefined
  if (doc.preview) {
    const source = path.resolve(path.dirname(file.absPath), doc.preview)
    const ext = path.extname(source).toLowerCase()
    preview = { source, publicPath: `/sections/${doc.name}${ext}` }
  }
  return {
    kind: 'section',
    name: doc.name,
    slug: doc.name,
    interfaceName: `${toPascalCase(doc.name)}Block`,
    label: doc.label,
    plural: doc.plural ?? pluralise(doc.label),
    description: doc.description,
    group: doc.group ?? DEFAULT_GROUP,
    preview,
    fields: normaliseFields(doc.fields, file, diagnostics),
    layout: doc.layout,
    file,
  }
}

export function normaliseGlobal(doc: GlobalFile, file: LoadedFile, diagnostics: Diagnostics): NGlobal {
  return {
    kind: 'global',
    name: doc.name,
    slug: doc.name,
    interfaceName: toPascalCase(doc.name),
    label: doc.label ?? toLabel(doc.name),
    fields: normaliseFields(doc.fields, file, diagnostics),
    layout: doc.layout,
    file,
  }
}
