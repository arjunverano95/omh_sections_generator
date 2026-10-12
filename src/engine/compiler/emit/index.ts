/**
 * The six generated files (compiler.md section 4). Pure functions from the normalised
 * template to file contents; `compile()` decides where they go.
 */

import type { FieldMeta, Manifest } from '../../manifest'
import { COLOR_SLOTS } from '../../schema/common'
import type { NField, NFont, NGlobal, NormalisedTemplate, NSection } from '../normalise'
import { newHelperUse, toPayloadField, type HelperUse } from './fields'
import { header, printValue, raw } from './print'

export type GeneratedFiles = {
  'manifest.ts': string
  'blocks.ts': string
  'globals.ts': string
  'plan.ts': string
  'theme.css': string
  'fonts.ts': string
}

export const GENERATED_FILE_NAMES = ['manifest.ts', 'blocks.ts', 'globals.ts', 'plan.ts', 'theme.css', 'fonts.ts'] as const

function fieldMeta(field: NField): FieldMeta {
  const meta: FieldMeta = { name: field.name, type: field.type, label: field.label, required: field.required }
  if (field.options) meta.options = field.options
  if (field.to) meta.to = field.to
  if (field.many) meta.many = field.many
  if (field.fields) meta.fields = field.fields.map(fieldMeta)
  if (field.min !== undefined) meta.min = field.min
  if (field.max !== undefined) meta.max = field.max
  return meta
}

export function buildManifest(t: Omit<NormalisedTemplate, 'manifest'>): Manifest {
  const manifest: Manifest = {
    name: t.name,
    label: t.label,
    blocks: t.sections.map((s) => s.slug),
    globals: ['header', 'footer'],
    sections: {},
    globalMeta: {
      header: {
        name: 'header',
        slug: 'header',
        interfaceName: t.globals.header.interfaceName,
        fields: t.globals.header.fields.map(fieldMeta),
      },
      footer: {
        name: 'footer',
        slug: 'footer',
        interfaceName: t.globals.footer.interfaceName,
        fields: t.globals.footer.fields.map(fieldMeta),
      },
    },
  }
  if (t.description) manifest.description = t.description
  for (const section of t.sections) {
    manifest.sections[section.name] = {
      name: section.name,
      slug: section.slug,
      interfaceName: section.interfaceName,
      label: section.label,
      fields: section.fields.map(fieldMeta),
    }
  }
  return manifest
}

function emitManifest(t: NormalisedTemplate): string {
  return [
    header(t.name, 'what the active template is made of'),
    "import type { Manifest } from '@/engine/manifest'",
    '',
    `export const manifest: Manifest = ${printValue(buildManifest(t))}`,
    '',
  ].join('\n')
}

function helperImports(use: HelperUse): string[] {
  const lines: string[] = []
  if (use.defaultLexical) lines.push("import { defaultLexical } from '@/fields/defaultLexical'")
  const helpers = (['iconField', 'linkField', 'rowLabel'] as const).filter((h) => use[h])
  if (helpers.length) lines.push(`import { ${helpers.join(', ')} } from '@/engine/payload/fields'`)
  return lines
}

function blockConfig(section: NSection, use: HelperUse): Record<string, unknown> {
  return {
    slug: section.slug,
    interfaceName: section.interfaceName,
    labels: { singular: section.label, plural: section.plural },
    imageURL: section.preview?.publicPath,
    admin: { group: section.group },
    fields: section.fields.map((field) => toPayloadField(field, use)),
  }
}

function emitBlocks(t: NormalisedTemplate): string {
  const use = newHelperUse()
  const blocks = t.sections.map((section) => ({ section, config: blockConfig(section, use) }))
  const lines = [header(t.name, 'one Payload block per section'), "import type { Block } from 'payload'"]
  lines.push(...helperImports(use), '')
  for (const { section, config } of blocks) {
    lines.push(`export const ${section.interfaceName}: Block = ${printValue(config)}`, '')
  }
  lines.push(`export const blocks: Block[] = ${printValue(blocks.map(({ section }) => raw(section.interfaceName)))}`, '')
  return lines.join('\n')
}

function globalConfig(global: NGlobal, use: HelperUse): Record<string, unknown> {
  return {
    slug: global.slug,
    label: global.label,
    typescript: { interface: global.interfaceName },
    access: { read: raw('() => true') },
    fields: global.fields.map((field) => toPayloadField(field, use)),
    hooks: { afterChange: [raw(`revalidateGlobal('${global.slug}')`)] },
    versions: false,
  }
}

function emitGlobals(t: NormalisedTemplate): string {
  const use = newHelperUse()
  const headerConfig = globalConfig(t.globals.header, use)
  const footerConfig = globalConfig(t.globals.footer, use)
  const lines = [
    header(t.name, 'the header and footer globals'),
    "import type { GlobalConfig } from 'payload'",
    "import { revalidateGlobal } from '@/engine/payload/revalidateGlobal'",
  ]
  lines.push(...helperImports(use), '')
  lines.push(`export const Header: GlobalConfig = ${printValue(headerConfig)}`, '')
  lines.push(`export const Footer: GlobalConfig = ${printValue(footerConfig)}`, '')
  lines.push('export const globals: GlobalConfig[] = [Header, Footer]', '')
  return lines.join('\n')
}

function emitPlan(t: NormalisedTemplate): string {
  return [
    header(t.name, 'the render plan for every block and global'),
    "import type { Plans } from '@/engine/render/types'",
    '',
    `export const plans: Plans = ${printValue(t.plans)}`,
    '',
  ].join('\n')
}

function emitThemeCss(t: NormalisedTemplate): string {
  const { fonts, colors, radius } = t.theme
  const lines = [`/* Generated by \`pnpm sections:compile\` from templates/${t.name}: theme tokens. Do not edit. */`]
  lines.push(':root {')
  lines.push(`  --font-sans: var(${fonts.sans.variable});`)
  lines.push(`  --font-heading: var(${fonts.heading.variable});`)
  if (radius) lines.push(`  --radius: ${radius};`)
  for (const slot of COLOR_SLOTS) {
    const value = colors.light[slot]
    if (value) lines.push(`  --${slot}: ${value};`)
  }
  lines.push('}')
  const dark = COLOR_SLOTS.filter((slot) => colors.dark[slot])
  if (dark.length) {
    lines.push('', "[data-theme='dark'] {")
    for (const slot of dark) lines.push(`  --${slot}: ${colors.dark[slot]};`)
    lines.push('}')
  }
  lines.push('')
  return lines.join('\n')
}

function fontCall(font: NFont): string {
  const options: string[] = [
    `subsets: [${font.subsets.map((s) => `'${s}'`).join(', ')}]`,
    "display: 'swap'",
    `variable: '${font.variable}'`,
  ]
  if (font.weights) options.push(`weight: [${font.weights.map((w) => `'${w}'`).join(', ')}]`)
  return `${font.importName}({ ${options.join(', ')} })`
}

function emitFonts(t: NormalisedTemplate): string {
  const { sans, heading } = t.theme.fonts
  const sameFamily = heading.importName === sans.importName
  const imports = sameFamily ? [sans.importName] : [sans.importName, heading.importName]
  const lines = [
    header(t.name, 'the next/font/google loaders for the theme'),
    `import { ${imports.join(', ')} } from 'next/font/google'`,
    '',
    `const sans = ${fontCall(sans)}`,
  ]
  if (sameFamily) {
    lines.push('', 'export const fontVariables = sans.variable')
  } else {
    lines.push(`const heading = ${fontCall(heading)}`, '', 'export const fontVariables = `${sans.variable} ${heading.variable}`')
  }
  lines.push('')
  return lines.join('\n')
}

export function emitAll(t: NormalisedTemplate): GeneratedFiles {
  return {
    'manifest.ts': emitManifest(t),
    'blocks.ts': emitBlocks(t),
    'globals.ts': emitGlobals(t),
    'plan.ts': emitPlan(t),
    'theme.css': emitThemeCss(t),
    'fonts.ts': emitFonts(t),
  }
}
