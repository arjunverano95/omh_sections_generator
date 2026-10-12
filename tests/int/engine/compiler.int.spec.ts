/**
 * The compiler against its fixtures and the files under templates/ (compiler.md section 10).
 * No database: everything here is files in, files out.
 */

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { parse } from 'yaml'
import { afterAll, describe, expect, it } from 'vitest'

import { compile, schemaJsonText } from '@/engine/compiler'
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
      const result = compile({ templatesDir: dir, repoRoot: dir, check: true, schemaPath })
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

describe('missing files', () => {
  it('names each required file that is missing, with no position to point at', () => {
    const dir = tempDir('empty')
    const result = compile({ templatesDir: dir, repoRoot: dir, check: true, schemaPath })
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => `${d.file}: ${d.message}`)).toEqual([
      'globals/footer.yaml: file not found',
      'globals/header.yaml: file not found',
      'sections: holds no .yaml files; at least one section is needed',
      'theme.yaml: file not found',
    ])
    expect(result.diagnostics.every((d) => d.position === undefined)).toBe(true)
  })
})

describe('valid-minimal', () => {
  const dir = path.join(fixturesRoot, 'valid-minimal')

  it('compiles without diagnostics and writes the six files plus schema.json', () => {
    const out = tempDir('minimal')
    const result = compile({
      templatesDir: dir,
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
    const options = { templatesDir: dir, repoRoot: dir, outDir: out, publicDir: out, schemaPath: path.join(out, 's.json') }
    const first = compile(options)
    const second = compile(options)
    expect(second.files).toEqual(first.files)
    expect(second.written).toEqual([])
  })

  it('in check mode writes nothing and reports schema.json drift', () => {
    const out = tempDir('check')
    const result = compile({ templatesDir: dir, repoRoot: dir, outDir: out, check: true, schemaPath: path.join(out, 'missing.json') })
    expect(readdirSync(out)).toEqual([])
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.message)).toEqual([expect.stringContaining('missing')])
  })
})

describe('templates/', () => {
  const result = compile({ repoRoot, check: true, strict: true })

  it('passes sections:check (no errors, no warnings, schema.json current)', () => {
    expect(result.diagnostics).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('compiles one block per file under templates/sections, named by the section, in name order', () => {
    const names = readdirSync(path.join(repoRoot, 'templates', 'sections'))
      .filter((file) => /\.ya?ml$/i.test(file))
      .map((file) => file.replace(/\.ya?ml$/i, ''))
      .sort()
    expect(result.site!.manifest.blocks).toEqual(names)
    expect(result.site!.manifest.siteName).toBe('Studio')
  })

  for (const file of GENERATED_FILE_NAMES) {
    it(`emits ${file} as reviewed`, async () => {
      await expect(result.files![file]).toMatchFileSnapshot(path.join('__snapshots__', 'compiler', `${file}.snap`))
    })
  }
})

describe('list select derivation', () => {
  it('selects exactly what the children reference, plus slug for url', () => {
    const dir = tempDir('select')
    writeTemplates(dir, {
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
    const result = compile({ templatesDir: dir, repoRoot: dir, check: true, schemaPath })
    // valid-minimal's theme declares a variant this section does not use: a warning, not an error.
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([])

    const section = result.site!.plans['posts']![0]!
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
    expect(parseArgs(['--check', '--strict'])).toEqual({ check: true, strict: true, watch: false, help: false })
    expect(parseArgs(['--watch'])).toEqual({ check: false, strict: false, watch: true, help: false })
    expect(parseArgs([])).toEqual({ check: false, strict: false, watch: false, help: false })
  })

  it('refuses an unknown option', () => {
    expect(() => parseArgs(['--bogus'])).toThrow(/unknown option/)
  })
})

/** A complete templates folder around the given files; whatever is not given comes from valid-minimal. */
function writeTemplates(dir: string, files: Record<string, string>): void {
  const minimal = path.join(fixturesRoot, 'valid-minimal')
  const defaults: Record<string, string> = {
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
