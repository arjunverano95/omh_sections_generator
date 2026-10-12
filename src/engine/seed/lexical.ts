/**
 * Markdown to Lexical using the target field's own editor, so a seeded value only contains
 * nodes that field's editor supports (a section's richText uses the project's
 * `defaultLexical`; a post body has headings and blocks; a form's confirmation message
 * has headings).
 */
import type { FlattenedField, RichTextField, SanitizedConfig } from 'payload'
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

function collectionFields(config: SanitizedConfig, slug: string): FlattenedField[] | undefined {
  return config.collections.find((collection) => collection.slug === slug)?.flattenedFields
}

function blockFields(config: SanitizedConfig, blockSlug: string): FlattenedField[] | undefined {
  const layout = collectionFields(config, 'pages')?.find((field) => field.name === 'layout' && field.type === 'blocks')
  if (!layout || layout.type !== 'blocks') return undefined
  const block = layout.blocks.find((candidate) => typeof candidate !== 'string' && candidate.slug === blockSlug)
  if (block && typeof block !== 'string') return block.flattenedFields
  // Blocks registered on the config and referenced by slug.
  return config.blocks?.find((candidate) => candidate.slug === blockSlug)?.flattenedFields
}

/**
 * `config` is the sanitized config of the caller's own module graph: the awaited
 * `@payload-config` import, not `payload.config`.
 *
 * Next.js bundles `lexical` once per server layer, while `getPayload` caches one instance
 * for all of them. Inside a route handler, `payload.config` is usually the admin's copy
 * (an admin page initialised Payload first) and its editors hold node classes from the
 * admin layer's `lexical`, which the route layer's `createEditor` rejects as not
 * subclassing its `LexicalNode`. Reading the fields from the caller's config keeps the
 * node classes and the headless editor in the same copy. Outside Next.js the two configs
 * are the same object.
 */
export function createMarkdownConverter(config: SanitizedConfig) {
  const cache = new Map<string, ReturnType<typeof editorConfigFactory.fromField>>()

  return function markdownToLexical(markdown: string, target: Target): unknown {
    const key = JSON.stringify(target)
    let editorConfig = cache.get(key)
    if (!editorConfig) {
      let fields: FlattenedField[] | undefined
      if ('collection' in target) fields = collectionFields(config, target.collection)
      else if ('global' in target) fields = config.globals.find((g) => g.slug === target.global)?.flattenedFields
      else fields = blockFields(config, target.block)

      const field = fields && findRichTextField(fields, target.fieldPath)
      if (!field) throw new Error(`No richText field at ${key}; is the seed out of date with the compiled config?`)
      editorConfig = editorConfigFactory.fromField({ field })
      cache.set(key, editorConfig)
    }
    return convertMarkdownToLexical({ editorConfig, markdown })
  }
}

export type MarkdownConverter = ReturnType<typeof createMarkdownConverter>
