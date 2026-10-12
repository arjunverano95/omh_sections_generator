/**
 * The compiler against its fixtures and the shipped templates (compiler.md section 10).
 * No database: everything here is files in, files out.
 */

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { parse } from 'yaml'
import { afterAll, describe, expect, it } from 'vitest'

import { compile, discoverTemplates, schemaJsonText } from '@/engine/compiler'
import { parseArgs } from '@/engine/compiler/cli'
import { GENERATED_FILE_NAMES } from '@/engine/compiler/emit'
import type { ListNode } from '@/engine/render/types'

const repoRoot = process.cwd()
const fixturesRoot = path.join(repoRoot, 'tests', 'fixtures', 'templates')
const schemaPath = path.join(repoRoot, 'templates', 'schema.json')

const tempDirs: string[] = []
function tempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), `sections-${prefix}-`))
  tempDirs.push(dir)
  return dir
}
afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
})

type Expectation = { file: string; path: string; message: string }

describe('broken fixtures: one error each, where expect.yaml says', () => {
  const brokenRoot = path.join(fixturesRoot, 'broken')
  const names = readdirSync(brokenRoot).sort()

  it('covers the twelve validation rules', () => {
    expect(names).toHaveLength(12)
  })

  for (const name of names) {
    it(name, () => {
      const dir = path.join(brokenRoot, name)
      const expected = parse(readFileSync(path.join(dir, 'expect.yaml'), 'utf8')) as Expectation
      const result = compile({ templateDir: dir, repoRoot: dir, check: true, schemaPath })
      expect(result.ok).toBe(false)

      const errors = result.diagnostics.filter((d) => d.severity === 'error')
      const printed = errors.map((d) => `${d.file} | ${d.path} | ${d.message}${d.hint ? ` ${d.hint}` : ''}`)
      expect(printed, 'exactly one error').toHaveLength(1)

      const [error] = errors
      expect(error!.file).toBe(expected.file)
      expect(error!.path).toBe(expected.path)
      expect(`${error!.message} ${error!.hint ?? ''}`).toContain(expected.message)
      expect(error!.position, 'every error carries a line and column').toBeDefined()
    })
  }
})

describe('valid-minimal', () => {
  const dir = path.join(fixturesRoot, 'valid-minimal')

  it('compiles without diagnostics and writes the six files plus schema.json', () => {
    const out = tempDir('minimal')
    const result = compile({
      templateDir: dir,
      repoRoot: dir,
      outDir: path.join(out, 'generated'),
      publicDir: path.join(out, 'public'),
      schemaPath: path.join(out, 'schema.json'),
    })
    expect(result.diagnostics).toEqual([])
    expect(result.ok).toBe(true)
    // `written` is relative to repoRoot (the fixture here), so resolve before comparing.
    expect(result.written.map((file) => path.resolve(dir, file)).sort()).toEqual(
      [...GENERATED_FILE_NAMES.map((name) => path.join(out, 'generated', name)), path.join(out, 'schema.json')].sort(),
    )
    for (const name of GENERATED_FILE_NAMES) {
      expect(readFileSync(path.join(out, 'generated', name), 'utf8')).toBe(result.files![name])
    }
  })

  it('is deterministic and writes nothing the second time', () => {
    const out = tempDir('twice')
    const options = { templateDir: dir, repoRoot: dir, outDir: out, publicDir: out, schemaPath: path.join(out, 's.json') }
    const first = compile(options)
    const second = compile(options)
    expect(second.files).toEqual(first.files)
    expect(second.written).toEqual([])
  })

  it('in check mode writes nothing and reports schema.json drift', () => {
    const out = tempDir('check')
    const result = compile({ templateDir: dir, repoRoot: dir, outDir: out, check: true, schemaPath: path.join(out, 'missing.json') })
    expect(readdirSync(out)).toEqual([])
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.message)).toEqual([expect.stringContaining('missing')])
  })
})

describe('shipped templates', () => {
  const names = discoverTemplates(repoRoot)

  it('ships template-1 and template-2', () => {
    expect(names).toEqual(['template-1', 'template-2'])
  })

  for (const name of names) {
    describe(name, () => {
      const result = compile({ templateDir: path.join('templates', name), repoRoot, check: true, strict: true })

      it('passes sections:check (no errors, no warnings, schema.json current)', () => {
        expect(result.diagnostics).toEqual([])
        expect(result.ok).toBe(true)
      })

      for (const file of GENERATED_FILE_NAMES) {
        it(`emits ${file} as reviewed`, async () => {
          await expect(result.files![file]).toMatchFileSnapshot(path.join('__snapshots__', 'compiler', name, `${file}.snap`))
        })
      }
    })
  }
})

describe('list select derivation', () => {
  it('selects exactly what the children reference, plus slug for url', () => {
    const dir = path.join(tempDir('select'), 'select-demo')
    writeTemplate(dir, {
      'sections/posts.yaml': `
name: posts
label: Posts
fields:
  heading: text
  category:
    type: relation
    to: categories
layout:
  - div: container
    as: section
    children:
      - text: heading
        as: h2
      - list:
          collection: posts
          limit: 3
          sort: -publishedAt
          where:
            categories:
              in:
                field: category
        as: ul
        children:
          - div: card
            as: li
            children:
              - image: meta.image
              - text: title
                as: h3
              - button: { label: Read, href: url }
`,
    })
    const result = compile({ templateDir: dir, repoRoot: dir, check: true, schemaPath })
    // valid-minimal's theme declares a variant this section does not use: a warning, not an error.
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([])

    const section = result.template!.plans['select-demo-posts']![0]!
    expect(section.type).toBe('div')
    const list = (section as { children: unknown[] }).children[1] as ListNode
    expect(list.type).toBe('list')
    expect(list.query).toEqual({
      collection: 'posts',
      limit: 3,
      sort: '-publishedAt',
      where: { categories: { in: { field: 'category' } } },
      select: { meta: { image: true }, slug: true, title: true },
    })
  })
})

describe('templates/schema.json', () => {
  it('equals the schema generated from src/engine/schema', () => {
    expect(readFileSync(schemaPath, 'utf8').replace(/\r\n/g, '\n')).toBe(schemaJsonText())
  })
})

describe('cli arguments', () => {
  it('parses the documented flags', () => {
    expect(parseArgs(['--template', 'template-2', '--check', '--strict'])).toMatchObject({
      template: 'template-2',
      check: true,
      strict: true,
      watch: false,
      all: false,
    })
    expect(parseArgs(['--template=template-2'])).toMatchObject({ template: 'template-2' })
  })

  it('refuses --all without --check', () => {
    expect(() => parseArgs(['--all'])).toThrow(/--check/)
    expect(() => parseArgs(['--bogus'])).toThrow(/unknown option/)
  })
})

/** A complete template around the given files; whatever is not given comes from valid-minimal. */
function writeTemplate(dir: string, files: Record<string, string>): void {
  const minimal = path.join(fixturesRoot, 'valid-minimal')
  const name = path.basename(dir)
  const defaults: Record<string, string> = {
    'template.yaml': readFileSync(path.join(minimal, 'template.yaml'), 'utf8').replace(/^name: .*$/m, `name: ${name}`),
    'theme.yaml': readFileSync(path.join(minimal, 'theme.yaml'), 'utf8'),
    'globals/header.yaml': readFileSync(path.join(minimal, 'globals', 'header.yaml'), 'utf8'),
    'globals/footer.yaml': readFileSync(path.join(minimal, 'globals', 'footer.yaml'), 'utf8'),
  }
  for (const [relative, content] of Object.entries({ ...defaults, ...files })) {
    const abs = path.join(dir, relative)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, content.trimStart())
  }
}
