# Compiler

Part of the [Sections Engine Specification](README.md). The compiler reads one template folder ([template-format.md](template-format.md)) and emits everything Payload and the renderer need. It is a build-time script with no runtime footprint.

## 1. Contract

- **Input:** `templates/<SITE_TEMPLATE>/`. `SITE_TEMPLATE` defaults to `template-1`.
- **Output:** `src/generated/sections/` (section 4). The path is stable so every import site is hand-written once; switching templates rewrites the folder.
- **Exit code:** 0 on success, 1 on any error. `pnpm dev` and `pnpm build` do not start on a failed compile.
- **Determinism:** the same input produces byte-identical output. Files are emitted in a fixed order with sorted keys.
- **No network, no database.** Fonts are referenced by name; the Next.js build fetches them.

## 2. Pipeline

```
discover   templates/<t>/template.yaml -> theme, globals, sections/*.yaml
load       parse YAML, keep source positions for every node
validate   zod schemas; structural errors stop here
resolve    references, variants, icon names, list selects; semantic errors stop here
normalise  short forms to long forms; defaults filled; one internal model
emit       blocks.ts, globals.ts, plan.ts, theme.css, fonts.ts, manifest.ts
```

Source layout:

```
src/engine/
  schema/        zod schemas: manifest, theme, section, global, seed; toJsonSchema()
  compiler/
    index.ts     compile(templateDir, outDir, options): CompileResult
    load.ts      YAML with positions
    validate.ts  schema pass
    resolve.ts   scopes, references, variants, list selects
    normalise.ts internal model (NormalisedTemplate)
    emit/        one file per output
    errors.ts    CompileError with file, position, path, message, hint
    cli.ts       argument parsing, watch mode, printing
```

## 3. Command line

```
pnpm sections:compile                       # SITE_TEMPLATE or template-1
pnpm sections:compile --template template-2
pnpm sections:compile --watch               # recompile on change under templates/<t>/
pnpm sections:compile --check               # validate only, write nothing
pnpm sections:check                         # --check --all --strict: every template, warnings fail
```

`package.json` scripts:

```json
"sections:compile": "tsx src/engine/compiler/cli.ts",
"sections:check":   "tsx src/engine/compiler/cli.ts --check --all --strict",
"predev":           "pnpm sections:compile && pnpm generate:types",
"prebuild":         "pnpm sections:compile && pnpm generate:types"
```

`generate:types` runs after every compile because the generated blocks change `src/payload-types.ts`. `tsx` is already a dev dependency (the e2e script loads it).

## 4. Generated files

All six files carry a first-line header naming the template and the command, and are gitignored (`src/generated/`).

### `manifest.ts`

```ts
export const manifest = {
  name: 'template-1',
  label: 'Studio',
  blocks: ['template-1-hero-split', 'template-1-features', /* ... */],
  globals: ['header', 'footer'],
} as const
```

### `blocks.ts`

One `Block` per section, exported by interface name, plus the ordered `blocks` array that `Pages.layout` mounts.

```ts
import type { Block } from 'payload'
import { link } from '@/fields/link'
import { defaultLexical } from '@/fields/defaultLexical'
import { iconField, rowLabel } from '@/engine/payload/fields'

export const Template1HeroSplitBlock: Block = {
  slug: 'template-1-hero-split',
  interfaceName: 'Template1HeroSplitBlock',
  labels: { singular: 'Split hero', plural: 'Split heroes' },
  imageURL: '/sections/template-1/hero-split.png',
  admin: { group: 'Heroes' },
  fields: [
    { name: 'eyebrow', type: 'text', label: 'Eyebrow' },
    { name: 'heading', type: 'text', label: 'Heading', required: true },
    { name: 'description', type: 'textarea', label: 'Description' },
    link({ appearances: false, overrides: { name: 'primaryButton', label: 'Primary button' } }),
    link({ appearances: false, overrides: { name: 'secondaryButton', label: 'Secondary button' } }),
    { name: 'image', type: 'upload', relationTo: 'media', label: 'Image', required: true },
  ],
}

export const blocks: Block[] = [Template1HeroSplitBlock, /* ... */]
```

Field mapping:

| Template type | Emitted Payload field |
| --- | --- |
| `text` | `{ type: 'text', maxLength? }` |
| `textarea` | `{ type: 'textarea', maxLength? }` |
| `richText` | `{ type: 'richText', editor: defaultLexical }` |
| `image` | `{ type: 'upload', relationTo: 'media' }` |
| `icon` | `iconField(name, options)`: a `select` whose options are the engine's curated icon list |
| `link` | `link({ appearances: false, overrides: { name, label, required } })` |
| `select` | `{ type: 'select', options }` |
| `number` | `{ type: 'number', min?, max? }` |
| `checkbox` | `{ type: 'checkbox' }` |
| `array` | `{ type: 'array', minRows?, maxRows?, fields, admin: { components: { RowLabel: rowLabel(field) } } }` where `rowLabel` returns `{ path: '@/engine/payload/RowLabel#RowLabel', clientProps: { field } }` |
| `form` | `{ type: 'relationship', relationTo: 'forms' }` |
| `relation` | `{ type: 'relationship', relationTo: to, hasMany: many }` |

`label`, `required`, `defaultValue` and `admin.description` (from `help`) are carried on every field. Nothing else is added: no admin-only fields, no empty groups, no `blockName` overrides.

`imageURL` is emitted only when the section declares `preview`; the compiler copies the file to `public/sections/<template>/<section>.<ext>` so the admin can serve it.

### `globals.ts`

```ts
import type { GlobalConfig } from 'payload'
import { revalidateGlobal } from '@/engine/payload/revalidateGlobal'

export const Header: GlobalConfig = {
  slug: 'header',
  typescript: { interface: 'Template1Header' },
  access: { read: () => true },
  fields: [/* mapped exactly as blocks */],
  hooks: { afterChange: [revalidateGlobal('header')] },
}
export const Footer: GlobalConfig = { /* ... */ }
export const globals = [Header, Footer]
```

`revalidateGlobal(slug)` is the hand-written factory that replaces the two per-global hook files; it revalidates the `global_<slug>` cache tag that `getCachedGlobal` already uses.

### `plan.ts`

The render plan: one node list per block slug and per global slug, fully resolved.

```ts
import type { Plan } from '@/engine/render/types'

export const plans = {
  'template-1-hero-split': [
    {
      type: 'div', as: 'section',
      className: 'container grid gap-10 py-20 md:grid-cols-2 md:items-center',
      children: [
        { type: 'text', source: { path: ['heading'] }, as: 'h1',
          className: 'font-heading text-5xl md:text-6xl leading-[1.05] tracking-tight' },
        /* ... */
      ],
    },
  ],
  header: [/* ... */],
  footer: [/* ... */],
} satisfies Record<string, Plan>
```

Plan node types (`src/engine/render/types.ts`):

```ts
type Ref = { path: string[] }                         // resolved by the renderer against the scope chain
type Source = Ref | { value: string }
type Condition = { path: string[]; equals?: unknown; not?: unknown }

type PlanNode =
  | { type: 'text';     source: Source; as: TextTag; className?: string; if?: Condition }
  | { type: 'richText'; source: Ref; className?: string; if?: Condition }
  | { type: 'image';    source: Ref; className?: string; priority?: boolean; sizes?: string; if?: Condition }
  | { type: 'icon';     source: Ref; className?: string; size?: number; if?: Condition }
  | { type: 'button';   source: Ref | { label?: string; href: Source; newTab?: boolean }; children?: PlanNode[]; className?: string; if?: Condition }
  | { type: 'div';      as: ContainerTag; className?: string; children: PlanNode[]; if?: Condition }
  | { type: 'each';     source: Ref; as?: ContainerTag; className?: string; children: PlanNode[]; if?: Condition }
  | { type: 'list';     query: ListQuery; as?: ContainerTag; className?: string; children: PlanNode[] }
  | { type: 'form';     source: Ref; className?: string; if?: Condition }

type ListQuery = {
  collection: 'posts' | 'pages' | 'categories'
  limit: number
  sort?: string
  where?: Record<string, unknown>          // with { field: name } placeholders left in place
  select: Record<string, unknown>          // derived from the children's references
}
```

What is resolved at compile time and therefore absent from the renderer: variants (merged into `className`), icon name validity, `as` validity, scope validity of every reference, the `select` of every list. The renderer trusts the plan.

### `theme.css`

```css
:root {
  --font-sans: var(--font-inter);
  --font-heading: var(--font-playfair-display);
  --radius: 0.5rem;
  --background: oklch(99% 0.005 90deg);
  --foreground: oklch(18% 0.01 60deg);
  /* every light token the theme sets */
}
[data-theme='dark'] {
  --background: oklch(16% 0.01 60deg);
  /* every dark token the theme sets */
}
```

Only the tokens the theme sets are emitted; the stock stylesheet keeps providing the rest. The file is imported after `globals.css` so it wins by order ([payload-integration.md section 3](payload-integration.md#3-changes-by-file)).

### `fonts.ts`

```ts
import { Inter, Playfair_Display } from 'next/font/google'

const sans = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' })
const heading = Playfair_Display({ subsets: ['latin'], display: 'swap', variable: '--font-playfair-display' })

export const fontVariables = `${sans.variable} ${heading.variable}`
```

`next/font/google` requires literal imports and module-scope calls, which is exactly why fonts are generated rather than read from the theme at runtime. The export name of a family is its name with spaces replaced by underscores; the CSS variable is its kebab-case.

## 5. Naming

| Thing | Rule | Example |
| --- | --- | --- |
| Block slug | `<template>-<section>` | `template-1-hero-split` |
| Block interface | PascalCase of template and section + `Block` | `Template1HeroSplitBlock` |
| Global slug | fixed: `header`, `footer` | |
| Global interface | PascalCase of template + `Header`/`Footer` | `Template1Header` |
| Export in `blocks.ts` | the interface name | |

Two templates can never collide on a block slug, so pages authored under one template keep a recognisable `blockType` even when another template is active.

## 6. Errors

Format:

```
templates/template-1/sections/hero-split.yaml:27:13
  layout[0].children[0].children[4].children[1].button
  "secondaryButon" is not a field of section "hero-split". Did you mean "secondaryButton"?
```

Rules:

- Every error carries the file path relative to the repository, a line and column from the YAML source, the document path, and a one-sentence message. A hint line follows when the compiler can suggest the fix (closest field name, the camelCase form of a hyphenated name, the list of allowed `as` values).
- All errors in a template are collected and printed together; the compiler does not stop at the first one.
- Warnings print after errors, prefixed `warning:`. `--strict` promotes them.
- Internal failures (a bug in the compiler) print a stack trace and exit 2, so they are distinguishable from template errors.

## 7. Lean output rules

- A block carries exactly the fields its section declares, in declared order.
- A plan carries exactly the nodes the layout declares. There is no wrapper around a block; spacing is the template's job. (The stock `RenderBlocks` wrapped every block in `my-16`; the engine does not.)
- A `list` query selects only the fields its children reference, plus `slug` for the synthetic `url`.
- `theme.css` carries only the tokens the theme sets.
- Unreferenced fields warn, so a block never asks editors for data nothing renders.

## 8. JSON Schema

`pnpm sections:compile` also writes `templates/schema.json` from the zod definitions (zod 4's `toJSONSchema`), using a discriminator on the top-level `kind` (`template`, `theme`, `section`, `global`) so one schema file serves every template file. It is committed, and the compiler fails when the committed file differs from the generated one so the two cannot drift.

## 9. Tailwind

Class strings are authored in YAML and copied into `plan.ts`. Tailwind 4's automatic source detection skips gitignored paths, which `src/generated/` is, so the stylesheet declares the template folder as a source explicitly:

```css
@source "../../../templates";
```

That is the whole of `templates/`, so the CSS contains the union of both faces' utilities. It is small and it keeps the directive static; narrowing it to the active template is listed in [build-plan.md](build-plan.md) under open issues.

## 10. Tests

`tests/int/engine/compiler.int.spec.ts` (Vitest already includes `tests/int/**/*.int.spec.ts`):

- Fixtures under `tests/fixtures/templates/`: a minimal valid template, and one broken fixture per validation rule in [template-format.md section 9](template-format.md#9-validation-rules). Each broken fixture asserts the file, path and message of its error.
- A snapshot of every generated file for `templates/template-1` and `templates/template-2`, so a change in emission is a reviewed diff.
- Determinism: compiling twice yields identical bytes.
- `select` derivation: a `list` whose children reference `title` and `meta.image` selects exactly `{ title: true, slug: true, meta: { image: true } }`.
- The committed `templates/schema.json` equals the generated one.
