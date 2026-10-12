import type { CollectionSlug, Payload, PayloadRequest } from 'payload'
import path from 'node:path'

import { seedTemplate } from '@/engine/seed'
import { manifest } from '@/generated/sections/manifest'

/** Cleared before every seed, so reseeding (or seeding another template) starts from nothing. */
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
 * Clears the content collections, then seeds the active template: its pages, forms, media
 * and globals from `templates/<name>/seed/`, plus the engine's demo posts.
 *
 * Next.js revalidation errors are normal when seeding without a server running; the seeder
 * writes with `disableRevalidate` and the stock hooks skip revalidation in that case.
 */
export const seed = async ({ payload, req }: { payload: Payload; req: PayloadRequest }): Promise<void> => {
  payload.logger.info(`Seeding database with ${manifest.label} (${manifest.name})...`)

  payload.logger.info(`— Clearing collections...`)

  await Promise.all(
    collections.map((collection) => payload.db.deleteMany({ collection, req, where: {} })),
  )

  await Promise.all(
    collections
      .filter((collection) => Boolean(payload.collections[collection].config.versions))
      .map((collection) => payload.db.deleteVersions({ collection, req, where: {} })),
  )

  await seedTemplate({
    payload,
    req,
    templateDir: path.resolve(process.cwd(), 'templates', manifest.name),
    manifest,
  })

  payload.logger.info('Seeded database successfully!')
}
