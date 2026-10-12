# OMH Sections Generator

A config-driven sections engine built on the Payload website template. A whole site face (theme, header, footer and a library of page sections) is described in YAML under `templates/`. A compiler turns the active face into Payload block and global configs plus a typed render plan, and one generic React renderer draws every section from that plan. Editors compose pages from the generated blocks in the Payload admin, with drafts and live preview working as usual. Adding a section, redesigning one, or adding a whole new face changes files under `templates/` and no `.ts` or `.tsx` file. Two faces ship with the repository: `template-1` "Studio" and `template-2` "Launch".

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

   One more variable is optional and not in `.env.example`: `SITE_TEMPLATE`, the active face. It defaults to `template-1`; see [Switching the face](#switching-the-face).

3. Start MongoDB:

   ```bash
   docker compose up -d mongo
   ```

4. Compile the active template and generate types. `pnpm dev` and `pnpm build` do this themselves through `predev` and `prebuild`, so this step is only needed on its own after editing a template while the server is stopped:

   ```bash
   pnpm sections:compile
   pnpm generate:types
   ```

5. Start the dev server:

   ```bash
   pnpm dev
   ```

   The site is at http://localhost:3000 and the admin at http://localhost:3000/admin. Create the first user when prompted.

6. Seed. On the admin dashboard, press the seed button. The seeder clears pages, media, forms and the header and footer, then builds the active face's demo site from `templates/<face>/seed/`.

### Checks

| Command | What it does |
| --- | --- |
| `pnpm sections:check` | Validates every template with warnings treated as errors |
| `pnpm sections:compile --watch` | Recompiles the active template on every change under it |
| `pnpm lint` | ESLint |
| `pnpm exec tsc --noEmit` | Type check |
| `pnpm test:int` | Vitest: compiler, renderer and seeder |
| `pnpm test:e2e` | Playwright: seeds the active face, loads `/`, checks the hero, header and footer, submits the form |
| `pnpm build` | Production build |

## Switching the face

`SITE_TEMPLATE` defaults to `template-1`. To run the other face, add `SITE_TEMPLATE=template-2` to `.env`, or prefix the command:

```bash
SITE_TEMPLATE=template-2 pnpm dev
```

The `predev` step compiles that face and regenerates the types before the server starts (`prebuild` does the same for `pnpm build`). Then press the seed button on the admin dashboard. Pages created under the other face keep block types the active config does not know; the admin shows them as unknown and the site skips them, which is why switching is followed by a reseed. The face is chosen at build time, not per request.

## Adding a section

1. Create `templates/<face>/sections/<name>.yaml`. The name is kebab-case and unique in the face.
2. Declare `fields` (what editors fill in) and `layout` (how the fields render):

   ```yaml
   # yaml-language-server: $schema=../../schema.json
   name: quote
   label: Quote
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
4. The block appears in the admin under the face's label, ready to add to a page.

Field types, layout primitives, references, literals, conditions and validation rules are specified in [docs/spec/template-format.md](docs/spec/template-format.md).

## Adding a face

1. Create `templates/<name>/`, where `<name>` is lowercase letters, digits and hyphens.
2. Add the required files: `template.yaml` (the manifest, whose `name` equals the folder name), `theme.yaml` (fonts, colour tokens, radius and named class variants), `globals/header.yaml`, `globals/footer.yaml`, and at least one file in `sections/`.
3. Optionally add demo content in `seed/pages.yaml`, `seed/globals.yaml`, `seed/forms.yaml` and the files they reference in `seed/media/`.
4. Set `SITE_TEMPLATE=<name>`, start the server and seed.

A face is configuration only. If it needs behaviour no primitive offers, the engine gains a primitive or an option. The face never gains code.

## Specification

The full specification is in [docs/spec/README.md](docs/spec/README.md):

- [template-format.md](docs/spec/template-format.md): the YAML files a face is made of
- [compiler.md](docs/spec/compiler.md): how a face becomes Payload config and a render plan
- [renderer.md](docs/spec/renderer.md): how a compiled section is drawn
- [payload-integration.md](docs/spec/payload-integration.md): what changes in the Payload app
- [demo-templates.md](docs/spec/demo-templates.md): the two demo faces
- [build-plan.md](docs/spec/build-plan.md): phases and acceptance checks
- [decisions.md](docs/spec/decisions.md): design decisions and the alternatives they were chosen over

The original brief is [docs/ASSIGNMENT.md](docs/ASSIGNMENT.md).

## Repository layout

```
templates/
  schema.json              JSON Schema for editor validation (generated, committed)
  template-1/              "Studio": manifest, theme, globals, sections, seed
  template-2/              "Launch": same shape
src/
  engine/
    schema/                zod schemas for every template file
    compiler/              loader, validator, emitters, CLI
    primitives/            Text, RichText, Image, Icon, Button, Container, Each, List, Form
    render/                RenderSections, RenderGlobal, the tree walker and scope resolution
    payload/               helpers the generated config imports
    seed/                  the generic seeder
  generated/sections/      compiler output for the active face (gitignored)
  collections/             Pages, Posts, Media, Categories, Users
  app/(frontend)/          the public site
  app/(payload)/           the admin and API routes
tests/
  int/                     Vitest integration tests
  e2e/                     Playwright end-to-end tests
docs/
  ASSIGNMENT.md            the brief
  spec/                    the specification
```

Posts, media, categories, forms, search, redirects, SEO and authentication behave as they do in the Payload website template.
