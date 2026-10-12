/**
 * Markdown to Lexical using the target field's own editor, so a seeded value only contains
 * nodes that field's editor supports (a section's richText uses the project's
 * `defaultLexical`; a post body has headings and blocks; a form's confirmation message
 * has headings).
 */
import type { FlattenedField, Payload, RichTextField } from 'payload'
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'

type Target =
  | { collection: 'forms' | 'posts' | 'pages'; fieldPath: string[] }
  | { global: string; fieldPath: string[] }
  | { block: string; fieldPath: string[] }

/** Walks named fields (array rows and groups by name) down to the richText field. */
export function findRichTextField(fields: FlattenedField[], fieldPath: string[]): RichTextField | undefined {
  const [head, ...rest] = fieldPath
  const field = fields.find((candidate) => 'name' in candidate && candidate.name === head)
  if (!field) return undefined
  if (rest.length === 0) return field.type === 'richText' ? field : undefined
  if ('flattenedFields' in field) return findRichTextField(field.flattenedFields, rest)
  return undefined
}

function blockFields(payload: Payload, blockSlug: string): FlattenedField[] | undefined {
  const layout = payload.collections.pages.config.flattenedFields.find(
    (field) => field.name === 'layout' && field.type === 'blocks',
  )
  if (!layout || layout.type !== 'blocks') return undefined
  const block = layout.blocks.find((candidate) => typeof candidate !== 'string' && candidate.slug === blockSlug)
  if (block && typeof block !== 'string') return block.flattenedFields
  // Blocks registered on the config and referenced by slug.
  return payload.config.blocks?.find((candidate) => candidate.slug === blockSlug)?.flattenedFields
}

export function createMarkdownConverter(payload: Payload) {
  const cache = new Map<string, ReturnType<typeof editorConfigFactory.fromField>>()

  return function markdownToLexical(markdown: string, target: Target): unknown {
    const key = JSON.stringify(target)
    let editorConfig = cache.get(key)
    if (!editorConfig) {
      let fields: FlattenedField[] | undefined
      if ('collection' in target) fields = payload.collections[target.collection].config.flattenedFields
      else if ('global' in target) fields = payload.globals.config.find((g) => g.slug === target.global)?.flattenedFields
      else fields = blockFields(payload, target.block)

      const field = fields && findRichTextField(fields, target.fieldPath)
      if (!field) throw new Error(`No richText field at ${key}; is the seed out of date with the compiled config?`)
      editorConfig = editorConfigFactory.fromField({ field })
      cache.set(key, editorConfig)
    }
    return convertMarkdownToLexical({ editorConfig, markdown })
  }
}

export type MarkdownConverter = ReturnType<typeof createMarkdownConverter>
