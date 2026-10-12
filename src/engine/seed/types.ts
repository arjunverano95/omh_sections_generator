/**
 * Shapes of the seed files as the seeder reads them. These mirror the seed schemas in
 * src/engine/schema/seed.ts and are replaced by their inferred types once that lands.
 */

/** Field values of one section, global or array row, as written in YAML. */
export type SeedValues = Record<string, unknown>

/** One entry of `sections:`, a single-key map from section name to its values. */
export type SeedSectionRow = Record<string, SeedValues>

export type SeedPage = {
  slug: string
  title: string
  sections: SeedSectionRow[]
  meta?: { title?: string; description?: string; image?: string }
}

export type SeedGlobals = Partial<Record<'header' | 'footer', SeedValues>>

export type SeedFormField = { blockType: string; name: string } & Record<string, unknown>

export type SeedForm = {
  key: string
  title: string
  submitButtonLabel?: string
  confirmationType?: 'message' | 'redirect'
  /** Markdown; stored as Lexical rich text. */
  confirmationMessage?: string
  fields: SeedFormField[]
}

export type SeedPost = {
  slug: string
  title: string
  excerpt?: string
  heroImage?: string
  /** Category titles; each is created once if it does not exist. */
  categories?: string[]
  publishedAt?: string
  /** Markdown. */
  content: string
}

/** `seed/media.yaml`: alt text keyed by file name. */
export type SeedMediaAlts = Record<string, string>
