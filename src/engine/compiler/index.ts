/**
 * `compile()`: the files under templates/ in, the generated files out (compiler.md). Every
 * stage collects diagnostics; nothing is written while there is an error.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import type { Plan } from '../render/types'
import { GlobalFileSchema, SectionFileSchema, ThemeSchema, toJsonSchema, type GlobalFile, type SectionFile, type ThemeFile } from '../schema'
import { GLOBAL_NAMES } from '../schema/common'
import { buildManifest, emitAll, GENERATED_FILE_NAMES, type GeneratedFiles } from './emit'
import { Diagnostics, type Diagnostic } from './errors'
import { loadYamlFile, toRepoPath, type LoadedFile } from './load'
import { normaliseGlobal, normaliseSection, normaliseTheme, toScopeFields, type NGlobal, type NormalisedSite, type NSection } from './normalise'
import { resolveLayout, warnUnreferenced, type ResolveContext, type Scope } from './resolve'
import { validateFile } from './validate'

export type CompileOptions = {
  /** The folder holding theme.yaml, globals/ and sections/, absolute or relative to `repoRoot`. Default `templates`. */
  templatesDir?: string
  /** Diagnostics print paths relative to this. Default: the current directory. */
  repoRoot?: string
  /** Default `src/generated/sections`. */
  outDir?: string
  /** Section previews are copied under `<publicDir>/sections/`. Default `public`. */
  publicDir?: string
  /** Default `templates/schema.json`. */
  schemaPath?: string
  /** Validate and resolve, write nothing. Drift in `schema.json` is reported. */
  check?: boolean
  /** Warnings fail the compile. */
  strict?: boolean
}

export type CompileResult = {
  ok: boolean
  /** Errors first, then warnings. */
  diagnostics: Diagnostic[]
  /** The generated modules, present once the site resolved without errors. */
  files?: GeneratedFiles
  /** The JSON Schema for `templates/schema.json`. */
  schemaJson: string
  /** Repository-relative paths this run changed on disk. */
  written: string[]
  site?: NormalisedSite
}

export const TEMPLATES_DIR = 'templates'
export const OUT_DIR = path.join('src', 'generated', 'sections')

/** Locale-independent order, so output is the same on every machine. */
function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function schemaJsonText(): string {
  return `${JSON.stringify(toJsonSchema(), null, 2)}\n`
}

function readText(absPath: string): string | undefined {
  return existsSync(absPath) ? readFileSync(absPath, 'utf8') : undefined
}

function writeIfChanged(absPath: string, content: string | Buffer): boolean {
  if (existsSync(absPath)) {
    const current = readFileSync(absPath)
    if (typeof content === 'string' ? current.toString('utf8') === content : current.equals(content)) return false
  }
  mkdirSync(path.dirname(absPath), { recursive: true })
  writeFileSync(absPath, content)
  return true
}

type Loaded = {
  theme?: { data: ThemeFile; file: LoadedFile }
  header?: { data: GlobalFile; file: LoadedFile }
  footer?: { data: GlobalFile; file: LoadedFile }
  sections: { data: SectionFile; file: LoadedFile }[]
}

/**
 * Load and validate the fixed layout: theme.yaml, globals/header.yaml, globals/footer.yaml
 * and sections/*.yaml (rules 1 to 4 and 8, 10 to 12 of the format).
 */
function loadFiles(templatesDir: string, repoRoot: string, diagnostics: Diagnostics): Loaded {
  const loaded: Loaded = { sections: [] }

  const themeFile = loadYamlFile(path.join(templatesDir, 'theme.yaml'), repoRoot, diagnostics)
  const theme = themeFile && validateFile(ThemeSchema, themeFile, diagnostics)
  if (themeFile && theme) loaded.theme = { data: theme, file: themeFile }

  for (const role of GLOBAL_NAMES) {
    const file = loadYamlFile(path.join(templatesDir, 'globals', `${role}.yaml`), repoRoot, diagnostics)
    const data = file && validateFile(GlobalFileSchema, file, diagnostics)
    if (!file || !data) continue
    if (data.name !== role) {
      diagnostics.error({
        file: file.file,
        position: file.positionOf(['name']),
        path: 'name',
        message: `globals/${role}.yaml is the ${role} global, but its name is "${data.name}"; the file is named by its role`,
      })
      continue
    }
    loaded[role] = { data, file }
  }

  const sectionsDir = path.join(templatesDir, 'sections')
  const names =
    existsSync(sectionsDir) && statSync(sectionsDir).isDirectory()
      ? readdirSync(sectionsDir)
          .filter((name) => /\.ya?ml$/i.test(name))
          .sort(byCodeUnit)
      : []
  if (names.length === 0) {
    diagnostics.error({
      file: toRepoPath(sectionsDir, repoRoot),
      path: '',
      message: 'holds no .yaml files; at least one section is needed',
    })
  }
  for (const name of names) {
    const file = loadYamlFile(path.join(sectionsDir, name), repoRoot, diagnostics)
    const data = file && validateFile(SectionFileSchema, file, diagnostics)
    if (file && data) loaded.sections.push({ data, file })
  }

  return loaded
}

export function compile(options: CompileOptions = {}): CompileResult {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd())
  const templatesDir = path.resolve(repoRoot, options.templatesDir ?? TEMPLATES_DIR)
  const outDir = path.resolve(repoRoot, options.outDir ?? OUT_DIR)
  const publicDir = path.resolve(repoRoot, options.publicDir ?? 'public')
  const schemaPath = path.resolve(repoRoot, options.schemaPath ?? path.join(TEMPLATES_DIR, 'schema.json'))
  const diagnostics = new Diagnostics()
  const schemaJson = schemaJsonText()
  const written: string[] = []

  const finish = (extra: Partial<CompileResult> = {}): CompileResult => {
    const ok = !diagnostics.hasErrors && !(options.strict && diagnostics.warnings.length > 0)
    return { ok, diagnostics: diagnostics.sorted(), schemaJson, written, ...extra }
  }

  // 1. load, validate
  const loaded = loadFiles(templatesDir, repoRoot, diagnostics)
  if (diagnostics.hasErrors || !loaded.theme || !loaded.header || !loaded.footer) return finish()

  // 2. normalise
  const theme = normaliseTheme(loaded.theme.data, loaded.theme.file)
  const header = normaliseGlobal(loaded.header.data, loaded.header.file, diagnostics)
  const footer = normaliseGlobal(loaded.footer.data, loaded.footer.file, diagnostics)
  const sections: NSection[] = []
  const seen = new Map<string, LoadedFile>()
  for (const { data, file } of loaded.sections) {
    const section = normaliseSection(data, file, diagnostics)
    const first = seen.get(section.name)
    if (first) {
      diagnostics.error({
        file: file.file,
        position: file.positionOf(['name']),
        path: 'name',
        message: `section name "${section.name}" is already used by ${first.file}; section names are unique`,
      })
      continue
    }
    seen.set(section.name, file)
    if (section.preview && !existsSync(section.preview.source)) {
      diagnostics.error({
        file: file.file,
        position: file.positionOf(['preview']),
        path: 'preview',
        message: `preview "${data.preview}" does not exist (looked for ${toRepoPath(section.preview.source, repoRoot)})`,
      })
    }
    sections.push(section)
  }
  if (diagnostics.hasErrors) return finish()

  // 3. resolve
  const plans: Record<string, Plan> = {}
  const shared = { theme, usedVariants: new Set<string>(), referenced: new Map() } satisfies Omit<ResolveContext, 'file' | 'diagnostics'>
  const resolveOwner = (owner: NSection | NGlobal, label: string) => {
    const ctx: ResolveContext = { ...shared, file: owner.file, diagnostics }
    const fields = toScopeFields(owner.fields)
    const scope: Scope = { kind: 'section', label, fields }
    plans[owner.slug] = resolveLayout(owner.layout, [scope], ctx, ['layout'])
    warnUnreferenced(fields, ctx, label)
  }
  for (const section of sections) resolveOwner(section, `section "${section.name}"`)
  resolveOwner(header, 'the header global')
  resolveOwner(footer, 'the footer global')

  for (const [group, names] of Object.entries(theme.variants)) {
    for (const name of Object.keys(names)) {
      const variant = `${group}.${name}`
      if (shared.usedVariants.has(variant)) continue
      diagnostics.warning({
        file: theme.file.file,
        position: theme.file.positionOf(['variants', group, name], { key: true }),
        path: `variants.${group}.${name}`,
        message: `variant "${variant}" is declared but no layout uses it`,
      })
    }
  }
  if (diagnostics.hasErrors) return finish()

  // 4. emit
  const partial = { dir: templatesDir, theme, globals: { header, footer }, sections, plans }
  const site: NormalisedSite = { ...partial, manifest: buildManifest(partial) }
  const files = emitAll(site)

  // 5. schema.json: written with the output, or checked for drift
  if (options.check) {
    const committed = readText(schemaPath)
    if (committed === undefined || committed.replace(/\r\n/g, '\n') !== schemaJson) {
      diagnostics.error({
        file: toRepoPath(schemaPath, repoRoot),
        path: '',
        message:
          committed === undefined
            ? 'is missing; run pnpm sections:compile and commit it'
            : 'is out of date with the schemas in src/engine/schema; run pnpm sections:compile and commit the result',
      })
    }
  }

  const result = finish({ files, site })
  if (options.check || !result.ok) return result

  // 6. write what changed
  for (const name of GENERATED_FILE_NAMES) {
    const abs = path.join(outDir, name)
    if (writeIfChanged(abs, files[name])) written.push(toRepoPath(abs, repoRoot))
  }
  for (const section of sections) {
    if (!section.preview) continue
    const abs = path.join(publicDir, ...section.preview.publicPath.split('/'))
    if (writeIfChanged(abs, readFileSync(section.preview.source))) written.push(toRepoPath(abs, repoRoot))
  }
  if (writeIfChanged(schemaPath, schemaJson)) written.push(toRepoPath(schemaPath, repoRoot))

  return { ...result, written }
}
