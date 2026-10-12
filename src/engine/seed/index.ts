/**
 * The generic seeder. Reads `templates/<t>/seed/*.yaml` and the engine's demo posts,
 * validates every value against the compiled manifest, then writes: categories, media,
 * posts, forms, pages (two passes so links between pages resolve) and finally the globals.
 *
 * Clearing the database is the seed endpoint's job; this module only creates.
 */
import { access } from 'node:fs/promises'
import path from 'node:path'
import type { Payload, PayloadRequest, RequiredDataFromCollectionSlug } from 'payload'

import type { GlobalName, Manifest } from '@/engine/manifest'

import { createMarkdownConverter, type MarkdownConverter } from './lexical'
import { altFor, loadPostsSeed, loadTemplateSeed, type TemplateSeed } from './load'
import { resolveToken, resolveValues, type DocumentId, type ResolveContext } from './resolve'
import { parseToken, slugify, type TokenKind } from './tokens'
import type { SeedPage, SeedPost, SeedValues } from './types'
import { SeedValidationError, validateValues, type SeedIssue } from './validate'

export { getHomeFallback } from './fallback'
export { SeedValidationError } from './validate'

export type SeedTemplateArgs = {
  payload: Payload
  req: PayloadRequest
  /** Absolute path of the active template folder, e.g. `<repo>/templates/template-1`. */
  templateDir: string
  manifest: Manifest
  /** Folder holding posts.yaml, media.yaml and media/. Defaults to src/engine/seed. */
  postsDir?: string
}

export type SeedSummary = {
  categories: number
  media: number
  posts: number
  forms: number
  pages: number
  globals: GlobalName[]
}

/** What a seed needs that must exist before anything is written: names, files, slugs. */
type Plan = {
  template: TemplateSeed
  posts: Awaited<ReturnType<typeof loadPostsSeed>>
  /** Template media files referenced anywhere, in first-use order. */
  templateMedia: string[]
  categories: { title: string; slug: string }[]
}

const NO_REVALIDATE = { disableRevalidate: true }

/** Loads and validates everything; throws SeedValidationError listing every problem. */
export async function planSeed(templateDir: string, manifest: Manifest, postsDir?: string): Promise<Plan> {
  const [template, posts] = await Promise.all([loadTemplateSeed(templateDir), loadPostsSeed(postsDir)])
  const issues: SeedIssue[] = []

  const categories = new Map<string, string>()
  for (const post of posts.posts) {
    for (const title of post.categories ?? []) categories.set(slugify(title), title)
  }

  const known = {
    page: new Set(template.pages.map((page) => page.slug)),
    form: new Set(template.forms.map((form) => form.key)),
    category: new Set(categories.keys()),
    media: new Set<string>(),
  }
  const templateMedia: string[] = []

  // Records every token a value uses and reports the ones that name nothing.
  const checkingContext = (file: string, where: string): ResolveContext => {
    const lookup = (kind: TokenKind) => (key: string) => {
      if (kind === 'media') {
        if (!templateMedia.includes(key)) templateMedia.push(key)
      } else if (!known[kind].has(key)) {
        issues.push({ file, where, path: '(reference)', message: `"@${kind}/${key}" names no ${kind} in the seed` })
      }
      return `${kind}:${key}`
    }
    return {
      media: lookup('media'),
      page: lookup('page'),
      form: lookup('form'),
      category: lookup('category'),
      richText: () => null,
    }
  }

  const seen = new Set<string>()
  template.pages.forEach((page, pageIndex) => {
    const where = `page "${page.slug ?? `#${pageIndex}`}"`
    if (!page.slug || !page.title) {
      issues.push({ file: 'pages.yaml', where, path: '(page)', message: 'every page needs a slug and a title' })
    }
    if (seen.has(page.slug)) issues.push({ file: 'pages.yaml', where, path: 'slug', message: 'duplicate page slug' })
    seen.add(page.slug)
    if (page.meta?.image) {
      tryResolve(() => resolveToken(page.meta!.image, 'media', checkingContext('pages.yaml', where)), 'pages.yaml', where, 'meta.image')
    }

    ;(page.sections ?? []).forEach((row, index) => {
      const entries = Object.entries(row ?? {})
      if (entries.length !== 1) {
        issues.push({ file: 'pages.yaml', where: `${where}, sections[${index}]`, path: '(section)', message: 'each section row is a map with exactly one section name' })
        return
      }
      const [name, values] = entries[0]!
      const sectionWhere = `${where}, section "${name}" (sections[${index}])`
      const section = manifest.sections[name]
      if (!section) {
        issues.push({
          file: 'pages.yaml',
          where: sectionWhere,
          path: '(section)',
          message: `"${name}" is not a section of ${manifest.name}; sections are ${Object.keys(manifest.sections).join(', ')}`,
        })
        return
      }
      const found = validateValues(values, section.fields, { file: 'pages.yaml', where: sectionWhere })
      issues.push(...found)
      if (found.length === 0) {
        tryResolve(() => resolveValues(values as SeedValues, section.fields, checkingContext('pages.yaml', sectionWhere)), 'pages.yaml', sectionWhere, '(section)')
      }
    })
  })

  for (const [name, values] of Object.entries(template.globals)) {
    const where = `global "${name}"`
    const meta = manifest.globalMeta[name as GlobalName]
    if (!meta) {
      issues.push({ file: 'globals.yaml', where, path: '(global)', message: 'globals are "header" and "footer"' })
      continue
    }
    const found = validateValues(values, meta.fields, { file: 'globals.yaml', where })
    issues.push(...found)
    if (found.length === 0) {
      tryResolve(() => resolveValues(values, meta.fields, checkingContext('globals.yaml', where)), 'globals.yaml', where, '(global)')
    }
  }

  const formKeys = new Set<string>()
  template.forms.forEach((form, index) => {
    const where = `form "${form.key ?? `#${index}`}"`
    if (!form.key || !form.title) issues.push({ file: 'forms.yaml', where, path: '(form)', message: 'every form needs a key and a title' })
    if (formKeys.has(form.key)) issues.push({ file: 'forms.yaml', where, path: 'key', message: 'duplicate form key' })
    formKeys.add(form.key)
    if (!Array.isArray(form.fields) || form.fields.length === 0) {
      issues.push({ file: 'forms.yaml', where, path: 'fields', message: 'a form needs at least one field' })
    }
  })

  posts.posts.forEach((post, index) => {
    const where = `post "${post.slug ?? `#${index}`}"`
    if (!post.slug || !post.title || !post.content) {
      issues.push({ file: 'posts.yaml', where, path: '(post)', message: 'every post needs a slug, a title and content' })
    }
    if (post.heroImage !== undefined) {
      const token = safeParse(post.heroImage)
      if (!token || token.kind !== 'media') issues.push({ file: 'posts.yaml', where, path: 'heroImage', message: 'expected a "@media/<file>" reference' })
    }
  })

  // Every referenced file exists before anything is uploaded.
  await Promise.all([
    ...templateMedia.map((file) => checkFile(template.mediaDir, file, 'pages.yaml or globals.yaml')),
    ...posts.posts
      .map((post) => safeParse(post.heroImage))
      .filter((token): token is { kind: TokenKind; key: string } => token?.kind === 'media')
      .map((token) => checkFile(posts.mediaDir, token.key, 'posts.yaml')),
  ])

  if (issues.length > 0) throw new SeedValidationError(issues)

  return {
    template,
    posts,
    templateMedia,
    categories: [...categories].map(([slug, title]) => ({ slug, title })),
  }

  function tryResolve(run: () => unknown, file: string, where: string, at: string) {
    try {
      run()
    } catch (error) {
      issues.push({ file, where, path: at, message: (error as Error).message })
    }
  }

  async function checkFile(dir: string, file: string, from: string) {
    try {
      await access(path.join(dir, file))
    } catch {
      issues.push({ file: from, where: `"@media/${file}"`, path: '(reference)', message: `no file ${path.join(dir, file)}` })
    }
  }
}

function safeParse(value: unknown) {
  try {
    return parseToken(value)
  } catch {
    return null
  }
}

export async function seedTemplate({ payload, req, templateDir, manifest, postsDir }: SeedTemplateArgs): Promise<SeedSummary> {
  const plan = await planSeed(templateDir, manifest, postsDir)
  const toLexical = createMarkdownConverter(payload)

  payload.logger.info(`— Seeding ${manifest.label} (${manifest.name})...`)

  const categoryIds = new Map<string, DocumentId>()
  for (const { slug, title } of plan.categories) {
    const doc = await payload.create({ collection: 'categories', data: { title, slug }, req, overrideAccess: true })
    categoryIds.set(slug, doc.id)
  }

  const upload = async (dir: string, file: string, alt: string): Promise<DocumentId> => {
    const doc = await payload.create({ collection: 'media', data: { alt }, filePath: path.join(dir, file), req, overrideAccess: true })
    return doc.id
  }

  const postMedia = new Map<string, DocumentId>()
  let postCount = 0
  for (const post of plan.posts.posts) {
    await createPost(post)
    postCount++
  }

  const templateMediaIds = new Map<string, DocumentId>()
  for (const file of plan.templateMedia) {
    templateMediaIds.set(file, await upload(plan.template.mediaDir, file, altFor(file, plan.template.alts)))
  }

  const formIds = new Map<string, DocumentId>()
  for (const form of plan.template.forms) {
    const data = {
      title: form.title,
      fields: form.fields,
      submitButtonLabel: form.submitButtonLabel,
      confirmationType: form.confirmationType ?? 'message',
      confirmationMessage: form.confirmationMessage
        ? toLexical(form.confirmationMessage, { collection: 'forms', fieldPath: ['confirmationMessage'] })
        : undefined,
      redirect: form.redirect,
      // Each notification email's message is Markdown in the seed and rich text in the form.
      emails: form.emails?.map((email) => ({
        ...email,
        message:
          typeof email.message === 'string'
            ? toLexical(email.message, { collection: 'forms', fieldPath: ['emails', 'message'] })
            : email.message,
      })),
    }
    const doc = await payload.create({
      collection: 'forms',
      // Built from YAML, so its shape is checked at runtime by Payload, not by the compiler.
      data: data as unknown as RequiredDataFromCollectionSlug<'forms'>,
      req,
      overrideAccess: true,
    })
    formIds.set(form.key, doc.id)
  }

  // Pass 1: every page exists as a draft, so pass 2 can link to any of them.
  const pageIds = new Map<string, DocumentId>()
  for (const page of plan.template.pages) {
    const doc = await payload.create({
      collection: 'pages',
      data: { title: page.title, slug: page.slug },
      draft: true,
      req,
      overrideAccess: true,
      context: NO_REVALIDATE,
    })
    pageIds.set(page.slug, doc.id)
  }

  const context = (richText: ResolveContext['richText']): ResolveContext => ({
    media: (file) => lookup(templateMediaIds, file, 'media'),
    page: (slug) => lookup(pageIds, slug, 'page'),
    form: (key) => lookup(formIds, key, 'form'),
    category: (slug) => lookup(categoryIds, slug, 'category'),
    richText,
  })

  // Pass 2: full layout, published.
  for (const page of plan.template.pages) {
    await payload.update({
      collection: 'pages',
      id: pageIds.get(page.slug)!,
      data: pageData(page, manifest, context, toLexical) as unknown as RequiredDataFromCollectionSlug<'pages'>,
      req,
      overrideAccess: true,
      context: NO_REVALIDATE,
    })
  }

  const globals: GlobalName[] = []
  for (const name of ['header', 'footer'] as const) {
    const values = plan.template.globals[name]
    if (!values) continue
    const data = resolveValues(
      values,
      manifest.globalMeta[name].fields,
      context((markdown, fieldPath) => toLexical(markdown, { global: name, fieldPath })),
    )
    await payload.updateGlobal({ slug: name, data, req, overrideAccess: true, context: NO_REVALIDATE })
    globals.push(name)
  }

  const summary: SeedSummary = {
    categories: categoryIds.size,
    media: postMedia.size + templateMediaIds.size,
    posts: postCount,
    forms: formIds.size,
    pages: pageIds.size,
    globals,
  }
  payload.logger.info(`— Seeded ${JSON.stringify(summary)}`)
  return summary

  async function createPost(post: SeedPost) {
    let heroImage: DocumentId | undefined
    const token = safeParse(post.heroImage)
    if (token?.kind === 'media') {
      heroImage = postMedia.get(token.key)
      if (heroImage === undefined) {
        heroImage = await upload(plan.posts.mediaDir, token.key, altFor(token.key, plan.posts.alts))
        postMedia.set(token.key, heroImage)
      }
    }
    const data = {
      title: post.title,
      slug: post.slug,
      _status: 'published',
      publishedAt: post.publishedAt,
      heroImage,
      categories: (post.categories ?? []).map((title) => categoryIds.get(slugify(title))!),
      content: toLexical(post.content, { collection: 'posts', fieldPath: ['content'] }),
      meta: { title: post.title, description: post.excerpt, image: heroImage },
    }
    await payload.create({
      collection: 'posts',
      data: data as unknown as RequiredDataFromCollectionSlug<'posts'>,
      req,
      overrideAccess: true,
      context: NO_REVALIDATE,
    })
  }
}

/** The data pass 2 writes for one page. Exported for tests. */
export function pageData(
  page: SeedPage,
  manifest: Manifest,
  context: (richText: ResolveContext['richText']) => ResolveContext,
  toLexical: MarkdownConverter,
): Record<string, unknown> {
  const layout = page.sections.map((row) => {
    const [name, values] = Object.entries(row)[0]!
    const section = manifest.sections[name]!
    return {
      blockType: section.slug,
      ...resolveValues(
        values,
        section.fields,
        context((markdown, fieldPath) => toLexical(markdown, { block: section.slug, fieldPath })),
      ),
    }
  })
  const meta = page.meta
    ? {
        title: page.meta.title,
        description: page.meta.description,
        image: page.meta.image ? resolveToken(page.meta.image, 'media', context(() => null)) : undefined,
      }
    : undefined
  return { title: page.title, slug: page.slug, _status: 'published', layout, ...(meta ? { meta } : {}) }
}

function lookup(ids: Map<string, DocumentId>, key: string, kind: TokenKind): DocumentId {
  const id = ids.get(key)
  if (id === undefined) throw new Error(`"@${kind}/${key}" was not created; planSeed should have caught this`)
  return id
}
