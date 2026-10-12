# OMH Sections Generator

A config-driven sections engine built on the Payload website template. A whole site (theme, header, footer and a library of page sections) is described in YAML under `templates/`. A compiler turns that folder into Payload block and global configs plus a typed render plan, and one generic React renderer draws every section from that plan. Editors compose pages from the generated blocks in the Payload admin, with drafts and live preview working as usual. Adding a section or redesigning one changes files under `templates/` and no `.ts` or `.tsx` file. The repository ships one demo site, "Studio": sixteen sections in five drawer groups, seeded into four pages.

## Running it

**Requirements.** Node 24 (the version is in `.nvmrc`), pnpm, and Docker for MongoDB. `payload` and every `@payloadcms/*` package are pinned to `4.0.0-beta.0`.

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env` and fill in the values. The variables are:

   | Variable | Purpose |
   | --- | --- |
   | `DATABASE_URL` | MongoDB connection string |
   | `PAYLOAD_SECRET` | Secret Payload signs tokens with |
   | `PREVIEW_SECRET` | Secret for draft preview links |
   | `CRON_SECRET` | Secret for the jobs endpoint |
   | `NEXT_PUBLIC_SERVER_URL` | Public URL of the site, e.g. `http://localhost:3000` |

3. Start MongoDB:

   ```bash
   docker compose up -d mongo
   ```

4. Compile the templates and generate types. `pnpm dev` and `pnpm build` do this themselves through `predev` and `prebuild`, so this step is only needed on its own after editing a template while the server is stopped:

   ```bash
   pnpm sections:compile
   pnpm generate:types
   ```

5. Start the dev server:

   ```bash
   pnpm dev
   ```

   The site is at http://localhost:3000 and the admin at http://localhost:3000/admin. Create the first user when prompted.

6. Seed. On the admin dashboard, press "Seed your database with Studio". The seeder clears pages, posts, media, forms and the header and footer, then builds the demo site from `templates/seed/`: Home, Services, About and Contact, the header and footer, two forms and the media they use.

### Scripts

| Command | What it does |
| --- | --- |
| `pnpm sections:compile` | Validates `templates/` and writes the generated files to `src/generated/sections/` |
| `pnpm sections:compile --watch` | Recompiles on every change under `templates/` |
| `pnpm sections:compile --check` | Validates and resolves only, writing nothing; reports `templates/schema.json` drift |
| `pnpm sections:compile --strict` | Treats warnings as errors |
| `pnpm sections:check` | `--check --strict`: the CI gate |
| `pnpm lint` | ESLint |
| `pnpm exec tsc --noEmit` | Type check |
| `pnpm test:int` | Vitest: compiler, renderer and seeder |
| `pnpm test:e2e` | Playwright: seeds through the endpoint, loads `/`, checks the hero, header and footer, submits the form |
| `pnpm build` | Production build |

The compiler exits 0 on success, 1 on template errors and 2 on a compiler bug.

## Adding a section

1. Create `templates/sections/<name>.yaml`. The name is kebab-case, unique, and equal to the file name; it is also the block's slug.
2. Declare `fields` (what editors fill in) and `layout` (how the fields render), and optionally a drawer `group`:

   ```yaml
   # yaml-language-server: $schema=../schema.json
   name: quote
   label: Quote
   group: Social proof
   fields:
     text:
       type: textarea
       required: true
     author: text
   layout:
     - div: container flex flex-col gap-3 py-16
       as: section
       children:
         - text: text
           as: blockquote
           class: text-2xl
         - text: author
           as: small
           class: text-muted-foreground
   ```

3. Run `pnpm sections:compile` (or keep `--watch` running). Errors name the file, line, column and the path inside the document, and suggest the fix.
4. The block appears in the admin's add-block drawer under its group (`Sections` when the file sets none), ready to add to a page.

A section is configuration only. If it needs behaviour no primitive offers, the engine gains a primitive or an option; the section never gains code. Field types, layout primitives, references, literals, conditions and validation rules are specified in [docs/spec/template-format.md](docs/spec/template-format.md).

## Specification

The full specification is in [docs/spec/README.md](docs/spec/README.md):

- [template-format.md](docs/spec/template-format.md): the YAML files under `templates/`
- [compiler.md](docs/spec/compiler.md): how the templates folder becomes Payload config and a render plan
- [renderer.md](docs/spec/renderer.md): how a compiled section is drawn
- [payload-integration.md](docs/spec/payload-integration.md): what changes in the Payload app
- [demo-site.md](docs/spec/demo-site.md): the Studio demo site
- [build-plan.md](docs/spec/build-plan.md): phases and acceptance checks
- [decisions.md](docs/spec/decisions.md): design decisions and the alternatives they were chosen over

The original brief is [docs/ASSIGNMENT.md](docs/ASSIGNMENT.md).

## Repository layout

```
templates/
  schema.json              JSON Schema for editor validation (generated, committed)
  theme.yaml               site name, colour mode, fonts, colour tokens, radius, variants
  globals/                 header.yaml, footer.yaml
  sections/                one section per file
  seed/                    pages.yaml, globals.yaml, forms.yaml, media.yaml, media/
src/
  engine/
    schema/                zod schemas for every file under templates/
    compiler/              loader, validator, emitters, CLI
    primitives/            Text, RichText, Image, Icon, Button, Container, Each, List, Form
    render/                RenderSections, RenderGlobal, the tree walker and scope resolution
    payload/               helpers the generated config imports
    seed/                  the generic seeder and the demo posts
  generated/sections/      compiler output (gitignored)
  collections/             Pages, Posts, Media, Categories, Users
  app/(frontend)/          the public site
  app/(payload)/           the admin and API routes
tests/
  int/                     Vitest integration tests
  e2e/                     Playwright end-to-end tests
  fixtures/templates/      valid and broken template fixtures for the compiler tests
docs/
  ASSIGNMENT.md            the brief
  spec/                    the specification
```

Posts, media, categories, forms, search, redirects, SEO and authentication behave as they do in the Payload website template.
