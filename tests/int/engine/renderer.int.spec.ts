import { createElement, type ReactElement } from 'react'
import { renderToReadableStream } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as lucide from 'lucide-react'

import type { PlanNode, Scope } from '@/engine/render/types'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  getPayload: vi.fn(),
  push: vi.fn(),
  revalidateTag: vi.fn(),
  useRowLabel: vi.fn(),
}))

// The List primitive is the only runtime caller of the Local API; no database is needed.
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('next/cache', () => ({ revalidateTag: mocks.revalidateTag }))
vi.mock('@payloadcms/ui', () => ({ useRowLabel: mocks.useRowLabel }))
// The project RichText reaches the code block's copy button, whose icon module imports CSS
// that Node cannot load outside the Next.js bundler.
vi.mock('@payloadcms/ui/icons/Copy', () => ({ CopyIcon: () => null }))

import { ICONS } from '@/engine/icons'
import { iconComponents } from '@/engine/payload/iconComponents'
import { iconField, linkField, rowLabel } from '@/engine/payload/fields'
import { RowLabel } from '@/engine/payload/RowLabel'
import { revalidateGlobal } from '@/engine/payload/revalidateGlobal'
import { fillWhere } from '@/engine/primitives/List'
import { RenderTree } from '@/engine/render/RenderTree'
import { resolve, test as testCondition } from '@/engine/render/scope'

/** Server-renders a tree, async components included, and returns its HTML. */
async function html(element: ReactElement): Promise<string> {
  const stream = await renderToReadableStream(element)
  await stream.allReady
  return new Response(stream).text()
}

async function render(nodes: PlanNode[], scope: Scope): Promise<HTMLElement> {
  const container = document.createElement('div')
  container.innerHTML = await html(createElement(RenderTree, { nodes, scope }))
  return container
}

const paragraph = (text: string) => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [
      {
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        textFormat: 0,
        children: [
          { type: 'text', text, format: 0, style: '', mode: 'normal', detail: 0, version: 1 },
        ],
      },
    ],
  },
})

const media = {
  id: 'm1',
  alt: 'A desk by a window',
  url: '/api/media/file/desk.webp',
  width: 1200,
  height: 800,
  mimeType: 'image/webp',
  updatedAt: '2026-10-01T00:00:00.000Z',
}

beforeEach(() => {
  mocks.find.mockReset()
  mocks.getPayload.mockReset()
  mocks.getPayload.mockResolvedValue({ find: mocks.find })
})

describe('primitives', () => {
  it('text emits its tag, classes and string', async () => {
    const el = await render(
      [{ type: 'text', source: { path: ['heading'] }, as: 'h2', className: 'text-4xl' }],
      [{ heading: 'Quiet tools' }],
    )
    expect(el.innerHTML).toBe('<h2 class="text-4xl">Quiet tools</h2>')
  })

  it('text prints literals, numbers as-is and ISO dates through formatDateTime', async () => {
    const el = await render(
      [
        { type: 'text', source: { value: 'Read more' }, as: 'span' },
        { type: 'text', source: { path: ['count'] }, as: 'span' },
        { type: 'text', source: { path: ['publishedAt'] }, as: 'small' },
        { type: 'text', source: { path: ['year'] }, as: 'span' },
      ],
      [{ count: 12000, publishedAt: '2026-03-15T12:00:00.000Z', year: '2026' }],
    )
    expect(el.innerHTML).toBe(
      '<span>Read more</span><span>12000</span><small>03/15/2026</small><span>2026</span>',
    )
  })

  it.each([undefined, null, '', '   ', []])('text with %j renders nothing', async (value) => {
    const el = await render(
      [{ type: 'text', source: { path: ['heading'] }, as: 'h2', className: 'x' }],
      [{ heading: value }],
    )
    expect(el.innerHTML).toBe('')
  })

  it('richText renders the project RichText without gutter, and nothing when empty', async () => {
    const el = await render(
      [{ type: 'richText', source: { path: ['body'] }, className: 'text-lg' }],
      [{ body: paragraph('Hello there') }],
    )
    const root = el.firstElementChild as HTMLElement
    expect(root.className).toContain('payload-richtext')
    expect(root.className).toContain('max-w-none')
    expect(root.className).toContain('prose')
    expect(root.className).toContain('text-lg')
    expect(root.className).not.toContain('container')
    expect(root.textContent).toBe('Hello there')

    const empty = paragraph('')
    empty.root.children[0].children = []
    expect(
      (await render([{ type: 'richText', source: { path: ['body'] } }], [{ body: empty }]))
        .innerHTML,
    ).toBe('')
    expect((await render([{ type: 'richText', source: { path: ['body'] } }], [{}])).innerHTML).toBe(
      '',
    )
  })

  it('image renders the media document with its alt and no wrapper', async () => {
    const el = await render(
      [{ type: 'image', source: { path: ['image'] }, className: 'rounded-xl', priority: true }],
      [{ image: media }],
    )
    const img = el.querySelector('img')
    expect(img?.getAttribute('alt')).toBe('A desk by a window')
    expect(img?.getAttribute('class')).toContain('rounded-xl')
    // Media draws a picture straight into the parent; priority adds React's preload link.
    expect(el.querySelector('div')).toBeNull()
    expect(el.querySelector('picture > img')).toBe(img)
  })

  it('image with an unpopulated upload renders nothing', async () => {
    const el = await render([{ type: 'image', source: { path: ['image'] } }], [{ image: 'm1' }])
    expect(el.innerHTML).toBe('')
  })

  it('icon renders the curated lucide icon, decorative, default size 20', async () => {
    const el = await render(
      [{ type: 'icon', source: { path: ['icon'] }, className: 'text-primary' }],
      [{ icon: 'arrow-right' }],
    )
    const svg = el.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.getAttribute('width')).toBe('20')
    expect(svg?.getAttribute('class')).toContain('text-primary')
    expect(svg?.getAttribute('class')).toContain('lucide-arrow-right')

    const unknown = await render([{ type: 'icon', source: { path: ['icon'] } }], [{ icon: 'nope' }])
    expect(unknown.innerHTML).toBe('')
  })

  it('button renders a link field through CMSLink with only the node classes', async () => {
    const el = await render(
      [{ type: 'button', source: { path: ['cta'] }, className: 'btn-primary' }],
      [{ cta: { type: 'custom', url: '/contact', label: 'Get in touch', newTab: true } }],
    )
    expect(el.innerHTML).toBe(
      '<a class="btn-primary" rel="noopener noreferrer" target="_blank" href="/contact">Get in touch</a>',
    )
  })

  it('button resolves page and post references', async () => {
    const el = await render(
      [
        { type: 'button', source: { path: ['a'] } },
        { type: 'button', source: { path: ['b'] } },
        { type: 'button', source: { path: ['c'] } },
      ],
      [
        {
          a: {
            type: 'reference',
            label: 'About',
            reference: { relationTo: 'pages', value: { slug: 'about' } },
          },
          b: {
            type: 'reference',
            label: 'Post',
            reference: { relationTo: 'posts', value: { slug: 'hello' } },
          },
          // The home page is served at the root, not at /home.
          c: {
            type: 'reference',
            label: 'Home',
            reference: { relationTo: 'pages', value: { slug: 'home' } },
          },
        },
      ],
    )
    expect([...el.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      '/about',
      '/posts/hello',
      '/',
    ])
  })

  it('button with an empty link or no label renders nothing', async () => {
    const nodes: PlanNode[] = [{ type: 'button', source: { path: ['cta'] } }]
    expect(
      (await render(nodes, [{ cta: { type: 'custom', url: '', label: 'Go' } }])).innerHTML,
    ).toBe('')
    expect(
      (await render(nodes, [{ cta: { type: 'custom', url: '/x', label: '' } }])).innerHTML,
    ).toBe('')
    expect((await render(nodes, [{}])).innerHTML).toBe('')
  })

  it('button literal takes a fixed label and a fixed or bound href', async () => {
    const el = await render(
      [
        { type: 'button', source: { label: 'Read', href: { path: ['url'] } }, className: 'link' },
        { type: 'button', source: { label: 'Home', href: { value: '/' } } },
      ],
      [{ url: '/posts/hello' }],
    )
    expect(el.innerHTML).toBe(
      '<a class="link" href="/posts/hello">Read</a><a class="" href="/">Home</a>',
    )
  })

  it('button with children wraps them and names the anchor by the link label', async () => {
    const el = await render(
      [
        {
          type: 'button',
          source: { path: ['home'] },
          className: 'flex gap-2',
          children: [{ type: 'text', source: { path: ['wordmark'] }, as: 'span' }],
        },
      ],
      [{ wordmark: 'Studio', home: { type: 'custom', url: '/', label: 'Studio home' } }],
    )
    expect(el.innerHTML).toBe(
      '<a class="flex gap-2" href="/"><span class="sr-only">Studio home</span>' +
        '<span aria-hidden="true" class="contents"><span>Studio</span></span></a>',
    )

    const unlabelled = await render(
      [
        {
          type: 'button',
          source: { href: { value: '/' } },
          children: [{ type: 'text', source: { value: 'Studio' }, as: 'span' }],
        },
      ],
      [{}],
    )
    expect(unlabelled.innerHTML).toBe('<a class="" href="/"><span>Studio</span></a>')
  })

  it('container emits its tag around its children', async () => {
    const el = await render(
      [
        {
          type: 'div',
          as: 'section',
          className: 'container py-20',
          children: [{ type: 'text', source: { path: ['heading'] }, as: 'h1' }],
        },
      ],
      [{ heading: 'Hi' }],
    )
    expect(el.innerHTML).toBe('<section class="container py-20"><h1>Hi</h1></section>')
  })

  it('a details container with a summary text renders a native disclosure', async () => {
    const el = await render(
      [
        {
          type: 'div',
          as: 'details',
          className: 'group border-b',
          children: [
            { type: 'text', source: { path: ['question'] }, as: 'summary', className: 'py-4' },
            { type: 'text', source: { path: ['answer'] }, as: 'p' },
          ],
        },
      ],
      [{ question: 'How long does a site take?', answer: 'Eight to twelve weeks.' }],
    )
    expect(el.innerHTML).toBe(
      '<details class="group border-b"><summary class="py-4">How long does a site take?</summary><p>Eight to twelve weeks.</p></details>',
    )
  })

  it('form renders the populated form document and nothing for an id', async () => {
    const form = {
      id: 'f1',
      title: 'Contact',
      submitButtonLabel: 'Send',
      confirmationType: 'message',
      fields: [
        { blockType: 'text', name: 'name', label: 'Name', required: true, width: 100 },
        { blockType: 'email', name: 'email', label: 'Email', required: true, width: 100 },
      ],
    }
    const el = await render(
      [{ type: 'form', source: { path: ['form'] }, className: 'max-w-xl' }],
      [{ form }],
    )
    expect(el.firstElementChild?.getAttribute('class')).toBe('max-w-xl')
    expect(el.querySelector('form')?.id).toBe('f1')
    expect([...el.querySelectorAll('input')].map((i) => i.getAttribute('name'))).toEqual([
      'name',
      'email',
    ])
    expect(el.querySelector('button[type="submit"]')?.textContent).toBe('Send')

    expect(
      (await render([{ type: 'form', source: { path: ['form'] } }], [{ form: 'f1' }])).innerHTML,
    ).toBe('')
  })
})

describe('scope', () => {
  it('a row reference shadows a section reference', () => {
    const scope: Scope = [{ title: 'row' }, { title: 'section' }]
    expect(resolve({ path: ['title'] }, scope)).toBe('row')
  })

  it('an outer reference is reachable from a row', () => {
    const scope: Scope = [{ title: 'row' }, { accent: 'gold', meta: { image: media } }]
    expect(resolve({ path: ['accent'] }, scope)).toBe('gold')
    expect(resolve({ path: ['meta', 'image', 'alt'] }, scope)).toBe(media.alt)
  })

  it('depth pins the declaring scope, so an unset row field does not fall through', () => {
    // A stored row omits an unset field; the section's same-named field must not leak in.
    const scope: Scope = [{ id: 'r1' }, { title: 'section' }]
    expect(resolve({ path: ['title'], depth: 0 } as { path: string[] }, scope)).toBeUndefined()
    expect(resolve({ path: ['title'], depth: 1 } as { path: string[] }, scope)).toBe('section')
    expect(resolve({ path: ['title'] }, scope)).toBe('section')
  })

  it('renders row and section references together inside each', async () => {
    const el = await render(
      [
        {
          type: 'each',
          source: { path: ['items'] },
          children: [
            { type: 'text', source: { path: ['title'] }, as: 'h3' },
            { type: 'text', source: { path: ['suffix'] }, as: 'span' },
          ],
        },
      ],
      [{ suffix: '!', title: 'section title', items: [{ id: 'a', title: 'One' }] }],
    )
    expect(el.innerHTML).toBe('<h3>One</h3><span>!</span>')
  })
})

describe('conditions', () => {
  const scope: Scope = [{ layout: 'wide', show: true, hide: false, empty: '' }]

  it('tests truthy, equals and not', () => {
    expect(testCondition({ path: ['show'] }, scope)).toBe(true)
    expect(testCondition({ path: ['hide'] }, scope)).toBe(false)
    expect(testCondition({ path: ['empty'] }, scope)).toBe(false)
    expect(testCondition({ path: ['missing'] }, scope)).toBe(false)
    expect(testCondition({ path: ['layout'], equals: 'wide' }, scope)).toBe(true)
    expect(testCondition({ path: ['layout'], equals: 'narrow' }, scope)).toBe(false)
    expect(testCondition({ path: ['layout'], not: 'narrow' }, scope)).toBe(true)
    expect(testCondition({ path: ['layout'], not: 'wide' }, scope)).toBe(false)
  })

  it('a failed condition emits no wrapper', async () => {
    const el = await render(
      [
        {
          type: 'div',
          as: 'div',
          className: 'badge',
          if: { path: ['hide'] },
          children: [{ type: 'text', source: { value: 'New' }, as: 'span' }],
        },
        {
          type: 'div',
          as: 'aside',
          if: { path: ['layout'], equals: 'wide' },
          children: [{ type: 'text', source: { value: 'Wide' }, as: 'span' }],
        },
      ],
      scope,
    )
    expect(el.innerHTML).toBe('<aside><span>Wide</span></aside>')
  })
})

describe('each', () => {
  const items = [
    { id: 'a', label: 'One' },
    { id: 'b', label: 'Two' },
  ]

  it('wraps rows in its tag when as is set', async () => {
    const el = await render(
      [
        {
          type: 'each',
          source: { path: ['items'] },
          as: 'ul',
          className: 'grid gap-4',
          children: [{ type: 'text', source: { path: ['label'] }, as: 'li' }],
        },
      ],
      [{ items }],
    )
    expect(el.innerHTML).toBe('<ul class="grid gap-4"><li>One</li><li>Two</li></ul>')
  })

  it('renders rows bare without as, and nothing for no rows', async () => {
    const nodes: PlanNode[] = [
      {
        type: 'each',
        source: { path: ['items'] },
        children: [{ type: 'text', source: { path: ['label'] }, as: 'p' }],
      },
    ]
    expect((await render(nodes, [{ items }])).innerHTML).toBe('<p>One</p><p>Two</p>')
    expect((await render(nodes, [{ items: [] }])).innerHTML).toBe('')
  })

  it('keys rows by id', async () => {
    const { Each } = await import('@/engine/primitives/Each')
    const output = Each({
      node: { type: 'each', source: { path: ['items'] }, children: [] },
      scope: [{ items }],
    }) as ReactElement[]
    expect(output.map((child) => child.key)).toEqual(['a', 'b'])
  })
})

describe('list', () => {
  const card: PlanNode = {
    type: 'list',
    as: 'div',
    className: 'grid',
    query: {
      collection: 'posts',
      limit: 3,
      sort: '-publishedAt',
      where: {
        and: [{ categories: { in: { field: 'category' } } }, { _status: { equals: 'published' } }],
      },
      select: { title: true, slug: true },
    },
    children: [{ type: 'button', source: { label: 'Read', href: { path: ['url'] } } }],
  }

  it('fills placeholders, passes select through and adds a url per document', async () => {
    mocks.find.mockResolvedValue({ docs: [{ id: 'p1', title: 'Hello', slug: 'hello' }] })

    const el = await render([card], [{ category: { id: 'c1', title: 'News' } }])

    expect(mocks.find).toHaveBeenCalledWith({
      collection: 'posts',
      limit: 3,
      sort: '-publishedAt',
      where: { and: [{ categories: { in: 'c1' } }, { _status: { equals: 'published' } }] },
      select: { title: true, slug: true },
      depth: 1,
      draft: false,
      overrideAccess: false,
    })
    expect(mocks.find.mock.calls[0][0].select).toBe(
      (card as { query: { select: unknown } }).query.select,
    )
    expect(el.innerHTML).toBe('<div class="grid"><a class="" href="/posts/hello">Read</a></div>')
  })

  it('drops a clause whose placeholder resolves empty', async () => {
    mocks.find.mockResolvedValue({ docs: [] })
    await render([card], [{}])
    expect(mocks.find.mock.calls[0][0].where).toEqual({
      and: [{ _status: { equals: 'published' } }],
    })

    expect(fillWhere({ category: { equals: { field: 'category' } } }, [{}])).toBeUndefined()
  })

  it('builds the url each collection is served at', async () => {
    mocks.find.mockResolvedValue({
      docs: [
        { id: 'h', slug: 'home' },
        { id: 'a', slug: 'about' },
      ],
    })
    const el = await render(
      [{ ...card, query: { collection: 'pages', limit: 2, select: { slug: true } } } as PlanNode],
      [{}],
    )
    expect([...el.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      '/',
      '/about',
    ])
  })

  it('renders nothing when no documents match', async () => {
    mocks.find.mockResolvedValue({ docs: [] })
    expect((await render([card], [{}])).innerHTML).toBe('')
  })
})

describe('end to end', () => {
  it('renders a section plan against seed data', async () => {
    mocks.find.mockResolvedValue({
      docs: [
        {
          id: 'p1',
          title: 'Shipping quietly',
          slug: 'shipping-quietly',
          publishedAt: '2026-09-02T12:00:00.000Z',
        },
        {
          id: 'p2',
          title: 'On restraint',
          slug: 'on-restraint',
          publishedAt: '2026-08-20T12:00:00.000Z',
        },
      ],
    })

    // Hand-written in the compiler's output shape: a hero, a feature grid and a post list.
    const plan: PlanNode[] = [
      {
        type: 'div',
        as: 'section',
        className: 'container grid gap-10 py-20 md:grid-cols-2',
        children: [
          {
            type: 'div',
            as: 'div',
            className: 'flex flex-col gap-6',
            children: [
              {
                type: 'text',
                source: { path: ['eyebrow'] },
                as: 'p',
                className: 'text-sm uppercase',
              },
              {
                type: 'text',
                source: { path: ['heading'] },
                as: 'h1',
                className: 'font-heading text-5xl',
              },
              { type: 'richText', source: { path: ['description'] }, className: 'text-lg' },
              { type: 'button', source: { path: ['primaryButton'] }, className: 'btn btn-primary' },
              { type: 'button', source: { path: ['secondaryButton'] }, className: 'btn btn-ghost' },
            ],
          },
        ],
      },
      {
        type: 'each',
        source: { path: ['features'] },
        as: 'ul',
        className: 'grid gap-6 md:grid-cols-3',
        children: [
          {
            type: 'div',
            as: 'li',
            className: 'flex gap-3',
            children: [
              { type: 'icon', source: { path: ['icon'] }, className: 'text-primary' },
              { type: 'text', source: { path: ['title'] }, as: 'h3' },
              {
                type: 'div',
                as: 'div',
                className: 'badge',
                if: { path: ['tone'], equals: 'new' },
                children: [{ type: 'text', source: { value: 'New' }, as: 'small' }],
              },
            ],
          },
        ],
      },
      {
        type: 'list',
        as: 'div',
        className: 'grid gap-4',
        query: {
          collection: 'posts',
          limit: 2,
          sort: '-publishedAt',
          select: { title: true, slug: true, publishedAt: true },
        },
        children: [
          {
            type: 'div',
            as: 'article',
            children: [
              { type: 'text', source: { path: ['publishedAt'] }, as: 'small' },
              { type: 'text', source: { path: ['title'] }, as: 'h3' },
              {
                type: 'button',
                source: { label: 'Read', href: { path: ['url'] } },
                className: 'link',
              },
            ],
          },
        ],
      },
    ]

    const seed = {
      id: 'row1',
      blockType: 'hero-split',
      eyebrow: 'Studio',
      heading: 'Small studio, careful work',
      description: paragraph('We build websites that stay out of the way.'),
      primaryButton: { type: 'custom', url: '/contact', label: 'Start a project' },
      secondaryButton: { type: 'custom', url: '', label: '' },
      features: [
        { id: 'f1', icon: 'zap', title: 'Fast', tone: 'new' },
        { id: 'f2', icon: 'shield', title: 'Safe' },
      ],
    }

    expect(await html(createElement(RenderTree, { nodes: plan, scope: [seed] }))).toMatchSnapshot()
  })
})

describe('payload helpers', () => {
  it('every icon in the vocabulary exists in the installed lucide-react', () => {
    const missing = Object.values(ICONS).filter((name) => !(name in lucide))
    expect(missing, `missing from lucide-react: ${missing.join(', ')}`).toEqual([])
  })

  it('every icon key has a component', () => {
    for (const key of Object.keys(ICONS) as (keyof typeof ICONS)[]) {
      expect(iconComponents[key]).toBe((lucide as Record<string, unknown>)[ICONS[key]])
    }
  })

  it('iconField is a select over the vocabulary with title-cased labels', () => {
    const field = iconField('icon', {
      label: 'Icon',
      required: true,
      admin: { description: 'Shown left' },
    })
    expect(field).toMatchObject({
      name: 'icon',
      type: 'select',
      label: 'Icon',
      required: true,
      admin: { description: 'Shown left' },
    })
    expect(field.options).toHaveLength(Object.keys(ICONS).length)
    expect(field.options).toContainEqual({ value: 'arrow-up-right', label: 'Arrow Up Right' })
    expect(iconField('icon', { label: 'Icon' })).not.toHaveProperty('required')
  })

  it('rowLabel points at the shared RowLabel with its field', () => {
    expect(rowLabel('title')).toEqual({
      path: '@/engine/payload/RowLabel#RowLabel',
      clientProps: { field: 'title' },
    })
  })

  it('RowLabel shows the field, a link label, or the row number', async () => {
    const label = async (data: unknown, rowNumber?: number) => {
      mocks.useRowLabel.mockReturnValue({ data, rowNumber, path: 'items.0' })
      return html(createElement(RowLabel, { field: 'title', path: 'items.0' }))
    }
    expect(await label({ title: 'Pricing' }, 0)).toBe('<div>Pricing</div>')
    expect(await label({ title: { type: 'custom', url: '/', label: 'Home' } }, 0)).toBe(
      '<div>Home</div>',
    )
    expect(await label({ title: '' }, 2)).toBe('<div>Row 3</div>')
  })

  it('revalidateGlobal revalidates the global tag unless disabled', () => {
    const hook = revalidateGlobal('footer')
    const req = { payload: { logger: { info: vi.fn() } }, context: {} }
    const doc = { id: 'g' }
    expect(hook({ doc, req } as unknown as Parameters<typeof hook>[0])).toBe(doc)
    expect(mocks.revalidateTag).toHaveBeenCalledWith('global_footer', 'max')

    mocks.revalidateTag.mockClear()
    hook({ doc, req: { ...req, context: { disableRevalidate: true } } } as unknown as Parameters<
      typeof hook
    >[0])
    expect(mocks.revalidateTag).not.toHaveBeenCalled()
  })
})

describe('follow-ups', () => {
  it('text renders a select label where the plan carries one, else the value', async () => {
    const node = {
      type: 'text',
      source: { path: ['tier'] },
      as: 'span',
      labels: { pro: 'Professional' },
    } as PlanNode
    expect((await render([node], [{ tier: 'pro' }])).innerHTML).toBe('<span>Professional</span>')
    expect((await render([node], [{ tier: 'team' }])).innerHTML).toBe('<span>team</span>')
  })

  it('a link with no target is empty for if and for Button', async () => {
    const empties = [
      { type: 'custom', url: '', label: 'Go' },
      { type: 'custom', label: 'Go' },
      { type: 'reference', reference: null, label: 'Go' },
      { type: 'reference', reference: { relationTo: 'pages', value: null }, label: 'Go' },
    ]
    for (const cta of empties) {
      expect(testCondition({ path: ['cta'] }, [{ cta }])).toBe(false)
      const el = await render(
        [
          {
            type: 'button',
            source: { path: ['cta'] },
            children: [{ type: 'text', source: { value: 'Logo' }, as: 'span' }],
          },
        ],
        [{ cta }],
      )
      expect(el.innerHTML).toBe('')
    }

    const targets = [
      { type: 'custom', url: '/x' },
      { type: 'reference', reference: { relationTo: 'pages', value: 'p1' } },
      { type: 'reference', reference: { relationTo: 'pages', value: { id: 'p1', slug: 'about' } } },
    ]
    for (const cta of targets) expect(testCondition({ path: ['cta'] }, [{ cta }])).toBe(true)
  })

  it('linkField relaxes the inner fields unless the link is required', () => {
    type Named = { name?: string; type: string; required?: boolean; fields?: Named[] }
    const requiredOf = (field: Named): Record<string, boolean | undefined> => {
      const out: Record<string, boolean | undefined> = {}
      const walk = (fields: Named[]) =>
        fields.forEach((f) => {
          if (f.type === 'row' && f.fields) walk(f.fields)
          else if (f.name) out[f.name] = f.required
        })
      walk(field.fields ?? [])
      return out
    }

    const optional = linkField('cta', {
      label: 'Call to action',
      admin: { description: 'Top right' },
    }) as unknown as Named & {
      label: string
      admin: { description?: string }
    }
    expect(optional).toMatchObject({ name: 'cta', type: 'group', label: 'Call to action' })
    expect(optional.admin.description).toBe('Top right')
    expect(requiredOf(optional)).toMatchObject({ label: false, reference: false, url: false })
    expect(requiredOf(optional)).not.toHaveProperty('appearance')

    const required = linkField('cta', {
      label: 'Call to action',
      required: true,
    }) as unknown as Named
    expect(requiredOf(required)).toMatchObject({ label: true, reference: true, url: true })
  })
})
