import { z } from 'zod'

/**
 * Seed files are read by the seeder only. These schemas check the shape of the files; the
 * values inside a section's data are checked against the section's fields by the seeder,
 * which knows the active manifest.
 */

/** `@media/<file>`, `@page/<slug>`, `@form/<key>`, `@category/<slug>` */
export const SEED_TOKEN_RE = /^@(media|page|form|category)\/(.+)$/
export type SeedTokenKind = 'media' | 'page' | 'form' | 'category'

export function parseSeedToken(value: unknown): { kind: SeedTokenKind; key: string } | null {
  if (typeof value !== 'string') return null
  const match = SEED_TOKEN_RE.exec(value)
  return match ? { kind: match[1] as SeedTokenKind, key: match[2]! } : null
}

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: 'slugs are kebab-case' })
const data = z.record(z.string(), z.unknown())

/** Field values of one section, global or array row, as written in YAML. */
export type SeedValues = z.infer<typeof data>

/** One entry of a page's `sections` list: `{ <section-name>: { ...fields } }`. */
export const SeedSectionSchema = z
  .record(z.string(), data)
  .refine((entry) => Object.keys(entry).length === 1, {
    error: 'a seeded section is written { <section-name>: { ...fields } }, one per list item',
  })
export type SeedSectionRow = z.infer<typeof SeedSectionSchema>

export const SeedPageSchema = z.strictObject({
  slug,
  title: z.string().min(1),
  sections: z.array(SeedSectionSchema).min(1, { error: 'a seeded page has at least one section' }),
  meta: z
    .strictObject({
      title: z.string().optional(),
      description: z.string().optional(),
      image: z.string().optional(),
    })
    .optional(),
})
export type SeedPage = z.infer<typeof SeedPageSchema>

/** `seed/pages.yaml` */
export const SeedPagesSchema = z.array(SeedPageSchema).min(1)

/** `seed/media.yaml` (optional): file name to alt text for the uploads under `seed/media/`. */
export const SeedMediaSchema = z.record(z.string().min(1), z.string())
export type SeedMedia = z.infer<typeof SeedMediaSchema>

/** `seed/globals.yaml` */
export const SeedGlobalsSchema = z.strictObject({
  header: data,
  footer: data,
})
export type SeedGlobals = z.infer<typeof SeedGlobalsSchema>

/** One form-builder field block; extra keys are the block's own options and pass through. */
export const SeedFormFieldSchema = z.looseObject({
  blockType: z.string().min(1),
  name: z.string().optional(),
  label: z.string().optional(),
  required: z.boolean().optional(),
  width: z.number().optional(),
})
export type SeedFormField = z.infer<typeof SeedFormFieldSchema>

export const SeedFormSchema = z.strictObject({
  key: z.string().regex(/^[a-z][a-zA-Z0-9-]*$/, { error: 'a form key is an identifier' }),
  title: z.string().min(1),
  submitButtonLabel: z.string().optional(),
  confirmationType: z.enum(['message', 'redirect']).optional(),
  /** Plain text or Markdown; the seeder converts it to the editor's rich text. */
  confirmationMessage: z.string().optional(),
  redirect: z.strictObject({ url: z.string().min(1) }).optional(),
  emails: z.array(z.record(z.string(), z.unknown())).optional(),
  fields: z.array(SeedFormFieldSchema).min(1),
})
export type SeedForm = z.infer<typeof SeedFormSchema>

/** `seed/forms.yaml` */
export const SeedFormsSchema = z.array(SeedFormSchema)

/** `src/engine/seed/posts.yaml`: the demo posts the blog and the latest-posts section list. */
export const SeedPostSchema = z.strictObject({
  slug,
  title: z.string().min(1),
  excerpt: z.string().optional(),
  /** `@media/<file>`, resolved against the engine's own seed media folder. */
  heroImage: z.string().optional(),
  categories: z.array(z.string().min(1)).optional(),
  /** ISO date; defaults to the seeding time, in file order. */
  publishedAt: z.string().optional(),
  /** Markdown, converted to the post body's rich text. */
  content: z.string().min(1),
  meta: z
    .strictObject({
      title: z.string().optional(),
      description: z.string().optional(),
      image: z.string().optional(),
    })
    .optional(),
})
export type SeedPost = z.infer<typeof SeedPostSchema>

export const SeedPostsSchema = z.array(SeedPostSchema)
