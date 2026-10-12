/**
 * The unseeded-home fallback: the active template's seeded home page as block rows, built
 * without a database. Nothing exists to point at, so media, forms and categories are left
 * out, internal links become plain URLs, and rich text becomes plain paragraphs.
 */
import path from 'node:path'

import type { Manifest } from '@/engine/manifest'

import { readSeedFile } from './load'
import { resolveValues, type ResolveContext } from './resolve'
import type { SeedPage } from './types'

export type FallbackRow = { id: string; blockType: string; blockName: null } & Record<string, unknown>

/** Thrown inside resolution to drop a value that needs a document. */
const SKIP = Symbol('skip')

export async function getHomeFallback(templateDir: string, manifest: Manifest): Promise<FallbackRow[]> {
  const pages = await readSeedFile<SeedPage[]>(path.join(templateDir, 'seed', 'pages.yaml'), [])
  const home = pages.find((page) => page.slug === 'home')
  if (!home) return []

  const context: ResolveContext = {
    media: () => SKIP as never,
    form: () => SKIP as never,
    category: () => SKIP as never,
    page: (slug) => slug as never,
    richText: (markdown) => plainLexical(markdown),
  }

  return (home.sections ?? []).flatMap((row, index) => {
    const [name, values] = Object.entries(row)[0] ?? []
    const section = name ? manifest.sections[name] : undefined
    if (!section || !values) return []
    const data = stripSkipped(resolveValues(values, section.fields, context)) as Record<string, unknown>
    return [{ id: `fallback-${index}`, blockType: section.slug, blockName: null, ...data }]
  })
}

/** Drops skipped values and turns internal links into custom URLs. */
function stripSkipped(value: unknown): unknown {
  if (Array.isArray(value)) return value.filter((item) => item !== SKIP).map(stripSkipped)
  if (typeof value !== 'object' || value === null) return value
  const record = value as Record<string, unknown>
  if (record.type === 'reference' && isPageRef(record.reference)) {
    const slug = String(record.reference.value)
    return { type: 'custom', url: slug === 'home' ? '/' : `/${slug}`, label: record.label, newTab: record.newTab }
  }
  return Object.fromEntries(
    Object.entries(record)
      .filter(([, item]) => item !== SKIP)
      .map(([key, item]) => [key, stripSkipped(item)]),
  )
}

const isPageRef = (value: unknown): value is { relationTo: 'pages'; value: unknown } =>
  typeof value === 'object' && value !== null && (value as { relationTo?: unknown }).relationTo === 'pages'

/** Paragraphs of plain text in Lexical's serialised shape, with Markdown emphasis removed. */
export function plainLexical(markdown: string) {
  const paragraphs = markdown
    .split(/\n\s*\n/)
    .map((block) => block.replace(/[*_`]+/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: paragraphs.map((text) => ({
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        textFormat: 0,
        textStyle: '',
        children: [{ type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }],
      })),
    },
  }
}
