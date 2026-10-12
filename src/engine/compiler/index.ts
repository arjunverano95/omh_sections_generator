/**
 * `compile()`: one template folder in, the generated files out (compiler.md). Every stage
 * collects diagnostics; nothing is written while there is an error.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import type { Plan } from '../render/types'
import {
  GlobalFileSchema,
  ManifestSchema,
  SectionFileSchema,
  ThemeSchema,
  toJsonSchema,
  type GlobalFile,
  type ManifestFile,
  type SectionFile,
  type ThemeFile,
} from '../schema'
import { buildManifest, emitAll, GENERATED_FILE_NAMES, type GeneratedFiles } from './emit'
import { Diagnostics, type Diagnostic } from './errors'
import { loadYamlFile, toRepoPath, type LoadedFile } from './load'
import {
  normaliseGlobal,
  normaliseSection,
  normaliseTheme,
  toScopeFields,
  type NGlobal,
  type NormalisedTemplate,
  type NSection,
} from './normalise'
import { resolveLayout, warnUnreferenced, type ResolveContext, type Scope } from './resolve'
import { validateFile } from './validate'

export type CompileOptions = {
  /** `templates/<name>`, absolute or relative to `repoRoot`. */
  templateDir: string
  /** Diagnostics print paths relative to this. Default: the current directory. */
  repoRoot?: string
  /** Default `src/generated/sections`. */
  outDir?: string
  /** Section previews are copied under `<publicDir>/sections/<template>/`. Default `public`. */
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
  /** The generated modules, present once the template resolved without errors. */
  files?: GeneratedFiles
  /** The JSON Schema for `templates/schema.json`. */
  schemaJson: string
  /** Repository-relative paths this run changed on disk. */
  written: string[]
  template?: NormalisedTemplate
}

export const DEFAULT_TEMPLATE = 'template-1'
export const TEMPLATES_DIR = 'templates'
export const OUT_DIR = path.join('src', 'generated', 'sections')

/** Every `templates/<name>/` holding a `template.yaml`, in name order. */
export function discoverTemplates(repoRoot: string): string[] {
  const dir = path.join(repoRoot, TEMPLATES_DIR)
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(dir, entry.name, 'template.yaml')))
    .map((entry) => entry.name)
    .sort(byCodeUnit)
}

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
  manifest: ManifestFile
  manifestFile: LoadedFile
  theme?: { data: ThemeFile; file: LoadedFile }
  header?: { data: GlobalFile; file: LoadedFile }
  footer?: { data: GlobalFile; file: LoadedFile }
  sections: { data: SectionFile; file: LoadedFile }[]
}

/** Discover, load and validate (rules 1 to 4 and 8, 10 to 12 of the format). */
function loadTemplate(templateDir: string, repoRoot: string, diagnostics: Diagnostics): Loaded | undefined {
  const manifestFile = loadYamlFile(path.join(templateDir, 'template.yaml'), repoRoot, diagnostics)
  if (!manifestFile) return undefined
  const manifest = validateFile(ManifestSchema, manifestFile, diagnostics)
  if (!manifest) return undefined

  const folder = path.basename(templateDir)
  if (manifest.name !== folder) {
    diagnostics.error({
      file: manifestFile.file,
      position: manifestFile.positionOf(['name']),
      path: 'name',
      message: `name is "${manifest.name}" but the folder is "${folder}"; the two must match`,
    })
  }

  const resolveEntry = (key: string[], given: string, kind: 'file' | 'folder'): string | undefined => {
    const abs = path.resolve(templateDir, given)
    const exists = existsSync(abs) && (kind === 'folder' ? statSync(abs).isDirectory() : statSync(abs).isFile())
    if (exists) return abs
    diagnostics.error({
      file: manifestFile.file,
      position: manifestFile.positionOf(key),
      path: key.join('.'),
      message: `"${given}" is not a ${kind} (looked for ${toRepoPath(abs, repoRoot)})`,
    })
    return undefined
  }

  const themePath = resolveEntry(['theme'], manifest.theme, 'file')
  const headerPath = resolveEntry(['globals', 'header'], manifest.globals.header, 'file')
  const footerPath = resolveEntry(['globals', 'footer'], manifest.globals.footer, 'file')
  const sectionsDir = resolveEntry(['sections'], manifest.sections, 'folder')

  const loaded: Loaded = { manifest, manifestFile, sections: [] }

  if (themePath) {
    const file = loadYamlFile(themePath, repoRoot, diagnostics)
    const data = file && validateFile(ThemeSchema, file, diagnostics)
    if (file && data) loaded.theme = { data, file }
  }

  for (const [role, absPath] of [
    ['header', headerPath],
    ['footer', footerPath],
  ] as const) {
    if (!absPath) continue
    const file = loadYamlFile(absPath, repoRoot, diagnostics)
    const data = file && validateFile(GlobalFileSchema, file, diagnostics)
    if (!file || !data) continue
    if (data.name !== role) {
      diagnostics.error({
        file: file.file,
        position: file.positionOf(['name']),
        path: 'name',
        message: `template.yaml lists this file as the ${role} global, but its name is "${data.name}"`,
      })
      continue
    }
    loaded[role] = { data, file }
  }

  if (sectionsDir) {
    const names = readdirSync(sectionsDir)
      .filter((name) => /\.ya?ml$/i.test(name))
      .sort(byCodeUnit)
    if (names.length === 0) {
      diagnostics.error({
        file: manifestFile.file,
        position: manifestFile.positionOf(['sections']),
        path: 'sections',
        message: `"${manifest.sections}" holds no .yaml files; a template needs at least one section`,
      })
    }
    for (const name of names) {
      const file = loadYamlFile(path.join(sectionsDir, name), repoRoot, diagnostics)
      const data = file && validateFile(SectionFileSchema, file, diagnostics)
      if (file && data) loaded.sections.push({ data, file })
    }
  }

  return loaded
}

export function compile(options: CompileOptions): CompileResult {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd())
  const templateDir = path.resolve(repoRoot, options.templateDir)
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

  // 1. discover, load, validate
  const loaded = loadTemplate(templateDir, repoRoot, diagnostics)
  if (!loaded || diagnostics.hasErrors || !loaded.theme || !loaded.header || !loaded.footer) return finish()

  // 2. normalise
  const templateName = loaded.manifest.name
  const templateLabel = loaded.manifest.label
  const theme = normaliseTheme(loaded.theme.data, loaded.theme.file)
  const header = normaliseGlobal(loaded.header.data, loaded.header.file, templateName, diagnostics)
  const footer = normaliseGlobal(loaded.footer.data, loaded.footer.file, templateName, diagnostics)
  const sections: NSection[] = []
  const seen = new Map<string, LoadedFile>()
  for (const { data, file } of loaded.sections) {
    const section = normaliseSection(data, file, templateName, templateLabel, diagnostics)
    const first = seen.get(section.name)
    if (first) {
      diagnostics.error({
        file: file.file,
        position: file.positionOf(['name']),
        path: 'name',
        message: `section name "${section.name}" is already used by ${first.file}; names are unique within a template`,
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
  const partial = {
    name: templateName,
    label: templateLabel,
    description: loaded.manifest.description,
    dir: templateDir,
    theme,
    globals: { header, footer },
    sections,
    plans,
  }
  const template: NormalisedTemplate = { ...partial, manifest: buildManifest(partial) }
  const files = emitAll(template)

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

  const result = finish({ files, template })
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
