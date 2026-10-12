import type { CollectionSlug, Payload, PayloadRequest, SanitizedConfig } from 'payload'
import { revalidatePath, revalidateTag } from 'next/cache'
import path from 'node:path'

import { seedSite } from '@/engine/seed'
import { manifest } from '@/generated/sections/manifest'

/** Cleared before every seed, so reseeding starts from nothing. */
const collections: CollectionSlug[] = [
  'categories',
  'media',
  'pages',
  'posts',
  'forms',
  'form-submissions',
  'search',
]

/**
 * Clears the content collections, then seeds the site: its pages, forms, media and globals
 * from `templates/seed/`, plus the engine's demo posts.
 *
 * Next.js revalidation errors are normal when seeding without a server running; the seeder
 * writes with `disableRevalidate` and the stock hooks skip revalidation in that case.
 *
 * `config` is the caller's own awaited `@payload-config` import, which the seeder's Markdown
 * conversion needs inside Next.js (see createMarkdownConverter).
 */
export const seed = async ({
  payload,
  req,
  config,
}: {
  payload: Payload
  req: PayloadRequest
  config?: SanitizedConfig
}): Promise<void> => {
  payload.logger.info(`Seeding database with ${manifest.siteName}...`)

  payload.logger.info(`— Clearing collections...`)

  await Promise.all(
    collections.map((collection) => payload.db.deleteMany({ collection, req, where: {} })),
  )

  await Promise.all(
    collections
      .filter((collection) => Boolean(payload.collections[collection].config.versions))
      .map((collection) => payload.db.deleteVersions({ collection, req, where: {} })),
  )

  const summary = await seedSite({
    payload,
    req,
    config,
    templatesDir: path.resolve(process.cwd(), 'templates'),
    manifest,
  })

  // The seeder writes without revalidation. This runs inside a Next.js request, so drop what
  // the seed replaced: the cached globals (the hooks' tags), the sitemaps and every rendered page.
  for (const slug of summary.globals) revalidateTag(`global_${slug}`, 'max')
  revalidateTag('pages-sitemap', 'max')
  revalidateTag('posts-sitemap', 'max')
  revalidatePath('/', 'layout')

  payload.logger.info('Seeded database successfully!')
}
