/** Reads seed YAML. A missing file is an empty seed; a malformed one names its path. */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'yaml'

import type { SeedForm, SeedGlobals, SeedMediaAlts, SeedPage, SeedPost } from './types'

export async function readSeedFile<T>(file: string, fallback: T): Promise<T> {
  let source: string
  try {
    source = await readFile(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback
    throw error
  }
  try {
    return (parse(source) as T | null) ?? fallback
  } catch (error) {
    throw new Error(`${file}: ${(error as Error).message}`)
  }
}

export type TemplateSeed = {
  pages: SeedPage[]
  globals: SeedGlobals
  forms: SeedForm[]
  alts: SeedMediaAlts
  mediaDir: string
}

export async function loadTemplateSeed(templateDir: string): Promise<TemplateSeed> {
  const seedDir = path.join(templateDir, 'seed')
  const [pages, globals, forms, alts] = await Promise.all([
    readSeedFile<SeedPage[]>(path.join(seedDir, 'pages.yaml'), []),
    readSeedFile<SeedGlobals>(path.join(seedDir, 'globals.yaml'), {}),
    readSeedFile<SeedForm[]>(path.join(seedDir, 'forms.yaml'), []),
    readSeedFile<SeedMediaAlts>(path.join(seedDir, 'media.yaml'), {}),
  ])
  return { pages, globals, forms, alts, mediaDir: path.join(seedDir, 'media') }
}

/**
 * The template-agnostic demo posts that ship with the engine. Resolved from the working
 * directory rather than `import.meta.url`, which points into the bundle under Next.js.
 */
export const ENGINE_SEED_DIR = path.resolve(process.cwd(), 'src/engine/seed')

export async function loadPostsSeed(seedDir = ENGINE_SEED_DIR): Promise<{
  posts: SeedPost[]
  alts: SeedMediaAlts
  mediaDir: string
}> {
  const [posts, alts] = await Promise.all([
    readSeedFile<SeedPost[]>(path.join(seedDir, 'posts.yaml'), []),
    readSeedFile<SeedMediaAlts>(path.join(seedDir, 'media.yaml'), {}),
  ])
  return { posts, alts, mediaDir: path.join(seedDir, 'media') }
}

/** Alt text for a media file: from media.yaml, else its name in sentence case. */
export function altFor(file: string, alts: SeedMediaAlts): string {
  if (alts[file]) return alts[file]
  const base = path.basename(file, path.extname(file)).replace(/[-_]+/g, ' ').trim()
  return base.charAt(0).toUpperCase() + base.slice(1)
}
