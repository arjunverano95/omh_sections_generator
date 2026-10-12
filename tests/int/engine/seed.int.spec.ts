import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { Payload, PayloadRequest } from 'payload'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FieldMeta, Manifest, SectionMeta } from '@/engine/manifest'

// The converter needs a live Payload config; the seeder's own logic does not.
vi.mock('@/engine/seed/lexical', () => ({
  createMarkdownConverter: () => (markdown: string, target: unknown) => ({ lexical: markdown, target }),
}))

const { getHomeFallback, planSeed, seedSite, SeedValidationError } = await import('@/engine/seed')
const { parseToken, slugify } = await import('@/engine/seed/tokens')
const { validateValues } = await import('@/engine/seed/validate')
const { resolveValues } = await import('@/engine/seed/resolve')

const TEMPLATES_DIR = path.resolve('templates')

// --- the manifest the compiler would emit for templates/, written out by hand ---

const f = (name: string, type: FieldMeta['type'], extra: Partial<FieldMeta> = {}): FieldMeta => ({
  name,
  type,
  label: name,
  required: false,
  ...extra,
})

const section = (name: string, fields: FieldMeta[]): SectionMeta => ({
  name,
  slug: name,
  interfaceName: `${name.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase())}Block`,
  label: name,
  fields,
})

const manifest: Manifest = {
  siteName: 'Studio',
  blocks: ['hero-split', 'features', 'latest-posts', 'testimonial', 'contact'],
  globals: ['header', 'footer'],
  sections: {
    'hero-split': section('hero-split', [
      f('eyebrow', 'text'),
      f('heading', 'text', { required: true }),
      f('description', 'textarea'),
      f('primaryButton', 'link'),
      f('secondaryButton', 'link'),
      f('image', 'image'),
    ]),
    features: section('features', [
      f('heading', 'text'),
      f('intro', 'textarea'),
      f('columns', 'select', { options: ['2', '3', '4'].map((value) => ({ value, label: value })) }),
      f('items', 'array', {
        min: 1,
        max: 8,
        fields: [f('icon', 'icon'), f('title', 'text', { required: true }), f('text', 'textarea')],
      }),
    ]),
    'latest-posts': section('latest-posts', [
      f('heading', 'text'),
      f('category', 'relation', { to: 'categories' }),
      f('allPostsLink', 'link'),
    ]),
    testimonial: section('testimonial', [
      f('quote', 'richText', { required: true }),
      f('name', 'text'),
      f('role', 'text'),
      f('avatar', 'image'),
    ]),
    contact: section('contact', [f('heading', 'text'), f('text', 'textarea'), f('form', 'form', { required: true })]),
  },
  globalMeta: {
    header: {
      name: 'header',
      slug: 'header',
      interfaceName: 'Header',
      fields: [f('logo', 'image', { required: true }), f('navItems', 'array', { max: 6, fields: [f('link', 'link')] }), f('cta', 'link')],
    },
    footer: {
      name: 'footer',
      slug: 'footer',
      interfaceName: 'Footer',
      fields: [
        f('columns', 'array', {
          max: 4,
          fields: [f('heading', 'text'), f('links', 'array', { fields: [f('link', 'link')] })],
        }),
        f('note', 'textarea'),
        f('social', 'array', { fields: [f('icon', 'icon', { required: true }), f('link', 'link', { required: true })] }),
      ],
    },
  },
}

// --- a Payload stand-in that records every write ---

type Call = { op: string; collection?: string; slug?: string; args: Record<string, unknown>; id?: string }

function mockPayload() {
  const calls: Call[] = []
  let next = 0
  const payload = {
    logger: { info: vi.fn() },
    create: vi.fn(async (args: Record<string, unknown>) => {
      const id = `${args.collection}-${++next}`
      calls.push({ op: 'create', collection: args.collection as string, args, id })
      return { id }
    }),
    update: vi.fn(async (args: Record<string, unknown>) => {
      calls.push({ op: 'update', collection: args.collection as string, args })
      return { id: args.id }
    }),
    updateGlobal: vi.fn(async (args: Record<string, unknown>) => {
      calls.push({ op: 'updateGlobal', slug: args.slug as string, args })
      return {}
    }),
  }
  return { payload: payload as unknown as Payload, calls }
}

const req = {} as PayloadRequest

describe('seed tokens', () => {
  it('parses each token kind and ignores plain strings', () => {
    expect(parseToken('@media/hero.jpg')).toEqual({ kind: 'media', key: 'hero.jpg' })
    expect(parseToken('@page/contact')).toEqual({ kind: 'page', key: 'contact' })
    expect(parseToken('@form/contact')).toEqual({ kind: 'form', key: 'contact' })
    expect(parseToken('@category/technology')).toEqual({ kind: 'category', key: 'technology' })
    expect(parseToken('hello@example.com')).toBeNull()
    expect(parseToken(3)).toBeNull()
  })

  it('rejects an unknown or malformed token instead of storing it as text', () => {
    expect(() => parseToken('@post/digital-horizons')).toThrow(/not a reference token/)
    expect(() => parseToken('@media')).toThrow(/not a reference token/)
  })

  it('slugifies category titles', () => {
    expect(slugify('Technology')).toBe('technology')
    expect(slugify('Café & Design')).toBe('cafe-design')
  })
})

describe('validateValues', () => {
  const at = { file: 'pages.yaml', where: 'page "home", section "features" (sections[1])' }
  const fields = manifest.sections.features!.fields

  it('accepts valid values', () => {
    expect(
      validateValues({ heading: 'Hi', columns: '3', items: [{ icon: 'zap', title: 'Fast' }] }, fields, at),
    ).toEqual([])
  })

  it('names the field path of every problem, rows included', () => {
    const issues = validateValues(
      { columns: 3, items: [{ icon: 'zap', title: 'ok' }, { icon: 'not-an-icon' }], bulletIcon: 'x' },
      fields,
      at,
    )
    expect(issues.map((issue) => [issue.path, issue.message])).toEqual([
      ['bulletIcon', expect.stringMatching(/not a field here/)],
      ['columns', expect.stringMatching(/expected one of "2", "3", "4", got 3/)],
      ['items[1].icon', expect.stringMatching(/not an icon name/)],
      ['items[1].title', 'is required'],
    ])
    expect(issues[0]).toMatchObject(at)
  })

  it('enforces array bounds', () => {
    const issues = validateValues({ items: [] }, fields, at)
    expect(issues).toEqual([expect.objectContaining({ path: 'items', message: 'needs at least 1 rows, has 0' })])
  })

  it('checks reference kinds and link shapes', () => {
    const hero = manifest.sections['hero-split']!.fields
    const issues = validateValues(
      {
        heading: 'x',
        image: '@page/home',
        primaryButton: { type: 'reference', reference: '@page/home' },
        secondaryButton: { type: 'custom', label: 'Go', href: '/x' },
      },
      hero,
      at,
    )
    expect(issues.map((issue) => issue.path)).toEqual([
      'primaryButton.label',
      'secondaryButton.href',
      'secondaryButton.url',
      'image',
    ])
  })
})

describe('resolveValues', () => {
  const context = {
    media: (file: string) => `media:${file}`,
    page: (slug: string) => `page:${slug}`,
    form: (key: string) => `form:${key}`,
    category: (slug: string) => `category:${slug}`,
    richText: (markdown: string, fieldPath: string[]) => ({ markdown, fieldPath }),
  }

  it('turns tokens into ids, links into the link group and Markdown into rich text', () => {
    const fields = [
      ...manifest.sections['hero-split']!.fields,
      f('rows', 'array', { fields: [f('body', 'richText')] }),
    ]
    expect(
      resolveValues(
        {
          heading: 'Hello',
          image: '@media/hero.jpg',
          primaryButton: { type: 'reference', reference: '@page/contact', label: 'Talk' },
          secondaryButton: { type: 'custom', url: '/posts', label: 'Read', newTab: true },
          rows: [{ body: '**Bold**' }],
        },
        fields,
        context,
      ),
    ).toEqual({
      heading: 'Hello',
      image: 'media:hero.jpg',
      primaryButton: { type: 'reference', label: 'Talk', newTab: false, reference: { relationTo: 'pages', value: 'page:contact' } },
      secondaryButton: { type: 'custom', label: 'Read', newTab: true, url: '/posts' },
      rows: [{ body: { markdown: '**Bold**', fieldPath: ['rows', 'body'] } }],
    })
  })

  it('leaves unset optional fields out', () => {
    expect(resolveValues({ heading: 'Only' }, manifest.sections['hero-split']!.fields, context)).toEqual({ heading: 'Only' })
  })
})

describe('planSeed', () => {
  it('accepts the seed under templates/ and lists what it needs', async () => {
    const plan = await planSeed(TEMPLATES_DIR, manifest)
    expect(plan.site.pages.map((page) => page.slug)).toEqual(['home', 'contact'])
    expect(plan.siteMedia.sort()).toEqual(['avatar.jpg', 'hero.jpg', 'logo.svg'])
    expect(plan.categories.map((category) => category.slug)).toEqual(['technology', 'news', 'finance'])
  })

  describe('with a broken seed', () => {
    let dir: string
    beforeEach(async () => {
      dir = await mkdtemp(path.join(os.tmpdir(), 'seed-'))
      await mkdir(path.join(dir, 'seed', 'media'), { recursive: true })
    })
    afterEach(() => rm(dir, { recursive: true, force: true }))

    it('fails before writing, naming page, section and field for every problem', async () => {
      await writeFile(
        path.join(dir, 'seed', 'pages.yaml'),
        [
          '- slug: home',
          '  title: Home',
          '  sections:',
          '    - hero-split:',
          '        headin: Typo',
          '        image: "@media/missing.jpg"',
          '    - contact:',
          '        form: "@form/nope"',
          '    - pricing: {}',
        ].join('\n'),
      )
      const error = await planSeed(dir, manifest).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(SeedValidationError)
      const issues = (error as InstanceType<typeof SeedValidationError>).issues
      expect(issues).toEqual([
        expect.objectContaining({ where: 'page "home", section "hero-split" (sections[0])', path: 'headin' }),
        expect.objectContaining({ where: 'page "home", section "hero-split" (sections[0])', path: 'heading', message: 'is required' }),
        expect.objectContaining({ where: 'page "home", section "contact" (sections[1])', message: '"@form/nope" names no form in the seed' }),
        expect.objectContaining({ where: 'page "home", section "pricing" (sections[2])', message: expect.stringMatching(/not a section; the sections are hero-split/) }),
      ])
      expect((error as Error).message).toContain('pages.yaml: page "home", section "hero-split" (sections[0]), field "heading": is required')
    })

    it('reports a referenced media file that does not exist', async () => {
      await writeFile(
        path.join(dir, 'seed', 'pages.yaml'),
        ['- slug: home', '  title: Home', '  sections:', '    - hero-split:', '        heading: Hi', '        image: "@media/missing.jpg"'].join('\n'),
      )
      await expect(planSeed(dir, manifest)).rejects.toThrow(/"@media\/missing.jpg".*no file/)
    })
  })
})

describe('seedSite', () => {
  it('writes categories, media, posts, forms, pages in two passes, then globals', async () => {
    const { payload, calls } = mockPayload()
    const summary = await seedSite({ payload, req, templatesDir: TEMPLATES_DIR, manifest })

    const order = calls.map((call) => `${call.op}:${call.collection ?? call.slug}`)
    const firstIndex = (entry: string) => order.indexOf(entry)
    const lastIndex = (entry: string) => order.lastIndexOf(entry)
    expect(lastIndex('create:categories')).toBeLessThan(firstIndex('create:posts'))
    expect(lastIndex('create:posts')).toBeLessThan(firstIndex('create:forms'))
    expect(lastIndex('create:forms')).toBeLessThan(firstIndex('create:pages'))
    expect(lastIndex('create:pages')).toBeLessThan(firstIndex('update:pages'))
    expect(lastIndex('update:pages')).toBeLessThan(firstIndex('updateGlobal:header'))

    expect(summary).toEqual({ categories: 3, media: 6, posts: 3, forms: 1, pages: 2, globals: ['header', 'footer'] })

    // Each media file is uploaded once, even when referenced twice (hero.jpg: hero and meta image).
    const uploads = calls.filter((call) => call.collection === 'media').map((call) => path.basename(call.args.filePath as string))
    expect(uploads.sort()).toEqual(['avatar.jpg', 'hero.jpg', 'logo.svg', 'post-1.jpg', 'post-2.jpg', 'post-3.jpg'])
    expect(calls.find((call) => String(call.args.filePath).endsWith('hero.jpg'))!.args.data).toEqual({
      alt: 'Blue and sand gradient with the word Studio',
    })

    // Pass 1 creates drafts; pass 2 publishes the full layout with links resolved to ids.
    const created = calls.filter((call) => call.op === 'create' && call.collection === 'pages')
    expect(created.map((call) => call.args.draft)).toEqual([true, true])
    const pageId = (slug: string) => created.find((call) => (call.args.data as { slug: string }).slug === slug)!.id

    const home = calls.find((call) => call.op === 'update' && call.args.id === pageId('home'))!.args.data as {
      _status: string
      layout: Record<string, unknown>[]
      meta: Record<string, unknown>
    }
    expect(home._status).toBe('published')
    expect(home.layout.map((row) => row.blockType)).toEqual(['hero-split', 'features', 'latest-posts', 'testimonial', 'contact'])
    expect(home.layout[0]!.primaryButton).toEqual({
      type: 'reference',
      label: 'Start a project',
      newTab: false,
      reference: { relationTo: 'pages', value: pageId('contact') },
    })
    expect(home.layout[2]!.category).toMatch(/^categories-/)
    expect(home.layout[3]!.quote).toEqual({
      lexical: expect.stringContaining('**love**'),
      target: { block: 'testimonial', fieldPath: ['quote'] },
    })
    expect(home.layout[4]!.form).toMatch(/^forms-/)
    expect(home.meta.image).toBe(home.layout[0]!.image)

    // The Contact page's hero has no image and stores none.
    const contact = calls.find((call) => call.op === 'update' && call.args.id === pageId('contact'))!.args.data as {
      layout: Record<string, unknown>[]
    }
    expect(contact.layout[0]).not.toHaveProperty('image')

    // A form's confirmation message is rich text, converted with the forms field's editor.
    const form = calls.find((call) => call.collection === 'forms')!.args.data as Record<string, unknown>
    expect(form.confirmationMessage).toEqual({
      lexical: 'Thanks for writing. We will be in touch within two working days.',
      target: { collection: 'forms', fieldPath: ['confirmationMessage'] },
    })

    // Posts are published with their categories and hero image.
    const post = calls.find((call) => call.collection === 'posts')!.args.data as Record<string, unknown>
    expect(post).toMatchObject({ slug: 'digital-horizons', _status: 'published', heroImage: expect.stringMatching(/^media-/) })
    expect(post.categories).toEqual([expect.stringMatching(/^categories-/)])

    const header = calls.find((call) => call.slug === 'header')!.args
    expect(header.context).toEqual({ disableRevalidate: true })
    expect((header.data as { navItems: unknown[] }).navItems).toHaveLength(3)
  })

  it('passes a form redirect through and converts each notification email message', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'seed-forms-'))
    try {
      await mkdir(path.join(dir, 'seed'), { recursive: true })
      await writeFile(
        path.join(dir, 'seed', 'forms.yaml'),
        [
          '- key: quote',
          '  title: Quote request',
          '  confirmationType: redirect',
          '  redirect:',
          '    url: /thanks',
          '  emails:',
          '    - emailTo: hello@example.com',
          '      subject: New quote request',
          '      message: "Thanks, **{{name}}**"',
          '  fields:',
          '    - blockType: text',
          '      name: name',
          '      required: true',
        ].join('\n'),
      )
      const { payload, calls } = mockPayload()
      await seedSite({ payload, req, templatesDir: dir, manifest })

      const form = calls.find((call) => call.collection === 'forms')!.args.data as Record<string, unknown>
      expect(form.confirmationType).toBe('redirect')
      expect(form.redirect).toEqual({ url: '/thanks' })
      expect(form.emails).toEqual([
        {
          emailTo: 'hello@example.com',
          subject: 'New quote request',
          message: { lexical: 'Thanks, **{{name}}**', target: { collection: 'forms', fieldPath: ['emails', 'message'] } },
        },
      ])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('writes nothing when the seed is invalid', async () => {
    const { payload, calls } = mockPayload()
    const broken: Manifest = { ...manifest, sections: { ...manifest.sections, contact: section('contact', [f('heading', 'text')]) } }
    await expect(seedSite({ payload, req, templatesDir: TEMPLATES_DIR, manifest: broken })).rejects.toThrow(SeedValidationError)
    expect(calls).toEqual([])
  })
})

describe('getHomeFallback', () => {
  it('returns the home layout as rows that need no documents', async () => {
    const rows = await getHomeFallback(TEMPLATES_DIR, manifest)
    expect(rows.map((row) => row.blockType)).toEqual(manifest.blocks)
    const [hero, , posts, testimonial, contact] = rows
    expect(hero).not.toHaveProperty('image')
    expect(hero!.primaryButton).toEqual({ type: 'custom', url: '/contact', label: 'Start a project', newTab: false })
    expect(posts).not.toHaveProperty('category')
    expect(contact).not.toHaveProperty('form')
    expect(testimonial).not.toHaveProperty('avatar')
    const quote = testimonial!.quote as { root: { children: { children: { text: string }[] }[] } }
    expect(quote.root.children[0]!.children[0]!.text).toMatch(/^Studio gave us a site our editors love to publish on\./)
  })
})
