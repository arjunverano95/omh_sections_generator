# Sections Engine Specification

**Version 1.0.** This is the specification for the OMH Sections Generator: a config-driven sections engine built on the Payload website template. The brief is in [ASSIGNMENT.md](../ASSIGNMENT.md).

## Documents

| Document | What it specifies |
| --- | --- |
| [template-format.md](template-format.md) | The YAML files under `templates/`: theme, sections, globals, fields, layout nodes, references, seeds, validation rules |
| [compiler.md](compiler.md) | How the templates folder becomes Payload config and a render plan: pipeline, generated files, CLI, errors, lean-output rules |
| [renderer.md](renderer.md) | How a compiled section is drawn: primitives, data binding, repeaters, data sources, forms, theme |
| [payload-integration.md](payload-integration.md) | What changes in the Payload app: Pages, globals, types, seeding, preview |
| [demo-site.md](demo-site.md) | The Studio demo site that proves the engine: its theme, chrome, sixteen sections and seed |
| [build-plan.md](build-plan.md) | Phases, deliverables and acceptance checks |
| [decisions.md](decisions.md) | Every design decision with the alternative it was chosen over |

## 1. Goal

Make everything a visitor sees config-driven. In the stock template every hero, block and section is a hand-written TypeScript config plus a React component. With the engine, the only hand-written React is a fixed set of **primitives** and the **engine** that interprets config. Everything a visitor sees comes from the files under `templates/`.

**Acceptance test.** Adding a section or redesigning a section adds or edits files under `templates/` and **no `.tsx` or `.ts` file**.

**Proof.** One site, Studio, with a theme, a header, a footer, sixteen sections, four pages and two forms, all produced from config alone.

## 2. Terms

| Term | Meaning |
| --- | --- |
| **Templates folder** | `templates/`: the theme, the header and footer globals, the sections and the seed. All config. |
| **Section** | One definition: the fields an editor fills in, the layout tree that renders them, and behaviour. One YAML file under `templates/sections/`. Compiles to one Payload block. |
| **Global** | A section-shaped definition rendered once per site (header, footer). Compiles to one Payload global. |
| **Primitive** | A generic renderable building block (text, image, button, container, repeater, form). Written once in React. |
| **Layout tree** | The nested list of primitive nodes that says how a section's fields are arranged and styled. |
| **Render plan** | The compiler's normalised, validated form of every layout tree, consumed by the renderer. |
| **Theme** | The site name, colour mode, brand tokens (fonts, colours, radius) and named class presets (variants). `templates/theme.yaml`. |
| **Site** | The Studio demo: what the templates folder describes and the seed fills with content. |

## 3. Architecture

```
templates/                                  config, written by people
  theme.yaml  globals/*.yaml  sections/*.yaml  seed/
          |
          v  pnpm sections:compile           (src/engine/compiler)
src/generated/sections/                     generated, gitignored
  blocks.ts  globals.ts  plan.ts  theme.css  fonts.ts  manifest.ts
          |                        |
          v                        v
  payload.config.ts            src/engine/render                (RenderSections, RenderGlobal, primitives)
  Pages.layout blocks          src/app/(frontend)/layout.tsx    (theme.css, fonts, header, footer)
  Header/Footer globals        src/app/(frontend)/[slug]/page.tsx
          |                        ^
          v                        |
  Payload admin: editors fill fields, order sections  -->  page documents  -->  rendered site
```

Three stages:

1. **Author.** The templates folder is YAML. Sections declare fields (what editors fill in) and a layout tree (how it renders). Globals do the same for header and footer. The theme declares the site name, tokens and variants.
2. **Compile.** `sections:compile` validates every file, resolves references, and emits Payload block and global configs, a typed render plan, theme CSS and font loaders into `src/generated/sections/`. It runs before `dev` and `build`.
3. **Run.** Payload mounts the generated blocks on Pages and the generated globals. Editors compose pages. The renderer walks the plan for each block row and binds the document's data to primitives. Nothing is per-section.

## 4. What is code and what is config

**Hand-written, section-agnostic (the engine), under `src/engine/`:**

- `schema/`: zod schemas for every file under `templates/` and the exported JSON Schema.
- `compiler/`: loader, validator, normaliser, emitters, CLI.
- `primitives/`: `Text`, `RichText`, `Image`, `Icon`, `Button`, `Container`, `Each`, `List`, `Form`.
- `render/`: `RenderSections`, `RenderGlobal`, `RenderTree`, the primitive registry, scope resolution.
- `payload/`: helpers the generated config imports (`revalidateGlobal` hook factory, field builders, the icon components).
- `seed/`: the generic seeder that reads `templates/seed/`, plus the demo posts.

**Config, under `templates/`:** theme, globals, sections, seed data and assets. Nothing executable. No `index.ts`.

The engine grows only when a section needs a primitive or an option that does not exist. A section never contains code.

## 5. Repository layout

```
templates/
  schema.json                 JSON Schema for editor validation (generated, committed)
  theme.yaml                  site name, colour mode, fonts, colours, radius, variants
  globals/header.yaml
  globals/footer.yaml
  sections/*.yaml             one section per file
  seed/                       pages.yaml, globals.yaml, forms.yaml, media.yaml, media/
src/
  engine/                     schema, compiler, primitives, render, payload, seed
  generated/sections/         compiler output (gitignored)
  collections/Pages/          layout field takes the generated blocks
  app/(frontend)/             imports theme.css and fonts; renders header, body, footer
docs/spec/                    this specification
```

## 6. Scope

**In scope:** page sections, header and footer, theme, forms (form-builder plugin), collection-fed lists, drafts and live preview for generated sections, seeding, the Studio demo site, compiler, renderer and seeder tests.

**Out of scope for version 1:** a visual builder in the admin; arbitrary code or expressions in config; more than one site per deployment; localisation; reproducing the stock template's hand-written page blocks one-for-one; posts and their rich-text blocks (posts stay as they are and serve as a data source).

## 7. Reading order for implementers

[template-format.md](template-format.md), then [compiler.md](compiler.md), then [renderer.md](renderer.md), then [payload-integration.md](payload-integration.md). [demo-site.md](demo-site.md) shows the format at full size. [build-plan.md](build-plan.md) says what to do first. [decisions.md](decisions.md) says why anything is the way it is.
