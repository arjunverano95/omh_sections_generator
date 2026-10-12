# Build Plan

Part of the [Sections Engine Specification](README.md). This is the working plan for the implementation: the requirements the work is graded against, the change intent, the phases, and the checklists that get ticked as the work lands.

## Requirements

Derived from [ASSIGNMENT.md](../ASSIGNMENT.md) and the decisions in [decisions.md](decisions.md).

- **R1** A declarative format that states a section's fields, layout and styling, with explicit nesting and repeatable groups, validated with errors that name the file, position and fix.
- **R2** Any number of sections, one file each under `templates/sections/`, discovered without code changes.
- **R3** A compiler that turns the templates folder into Payload block and global configs and a render plan, and from which TypeScript types follow through `payload generate:types`.
- **R4** A renderer that draws any compiled section from its plan with no per-section component.
- **R5** Editors pick a section in the admin, fill it in, place and reorder it on a page, and the site renders it, with drafts, preview and live preview working.
- **R6** The engine produces a whole site: theme, header, footer and a library of sections. The Studio demo is built from config alone and seeded so every section shows on a page.
- **R7** Behaviour is config-driven too: forms submit through the form-builder plugin and lists are fed from collections, both declared in YAML.
- **R8** Acceptance test: adding a section or redesigning one adds or edits files under `templates/` only. No `.ts` or `.tsx`.
- **R9** Lean output: a block has only the fields its section declares; markup is only what the layout asks for; queries select only what is referenced.
- **R10** TypeScript throughout; the project lints, type-checks, builds and its tests pass.
- **R11** The repository installs and runs from a clean clone (the base pins Payload at `workspace:*`, which does not install).
- **R12** Decisions and trade-offs are written down ([decisions.md](decisions.md)).

## Change Intent

```text
CONTRACT:  Pages compose from blocks generated out of templates/sections/; the header, footer, site
           name, fonts and colour tokens come from the same folder; the frontend renders all of it
           through one generic renderer. Posts, media, categories, forms, search, redirects, SEO, auth
           and the admin keep their stock behaviour.
BLAST:     src/engine/** (new); src/generated/** (new, ignored); templates/** (new);
           src/collections/Pages/index.ts (hero tab, layout blocks); src/payload.config.ts (globals);
           src/app/(frontend)/layout.tsx, [slug]/page.tsx, globals.css; src/endpoints/seed/**;
           the site-name consumers (src/plugins/index.ts, src/utilities/generateMeta.ts,
           src/utilities/mergeOpenGraph.ts, the posts and search page titles, the seed button);
           src/providers/Theme/{InitTheme/index.tsx,index.tsx} and src/providers/index.tsx
           (colorMode from the manifest);
           package.json, pnpm-lock.yaml, .gitignore, .nvmrc, Dockerfile (node base);
           src/payload-types.ts, src/app/(payload)/admin/importMap.js (regenerated);
           phase 4 only: removal of src/blocks/{ArchiveBlock,CallToAction,Content,Form,RenderBlocks.tsx},
           src/heros/{config.ts,HighImpact,MediumImpact,LowImpact,RenderHero.tsx}, src/Header/**,
           src/Footer/**, the stock seed documents.
           NOT src/collections/{Posts,Media,Categories,Users}, NOT the other src/providers,
           NOT src/components/{Media,RichText,Link,ui}, NOT the post page.
PRECEDENT: src/Header/config.ts (global shape, link() usage, RowLabel path, afterChange revalidate);
           src/blocks/Form/Component.tsx (form submission flow); src/utilities/getGlobals.ts (cached
           global read); src/endpoints/seed/index.ts (clear-then-create seeding).
RISK:      none of data loss, authz or public API. Build-time: next/font/google needs network at build.
ROLLBACK:  revert-only; no migrations (MongoDB), no schema outside Payload config.
VERIFY:    pnpm sections:check; pnpm test:int; pnpm lint; pnpm build; then pnpm dev, seed from the
           admin, open each seeded page, edit a section in the admin and see it live-preview, submit
           each form and find the submission in the admin.
```

## Design Intent

For the Studio demo site; the engine itself has no UI.

```text
MODE:   Persuade. Studio is a marketing site whose job is to make a visitor act.
LEAD:   The hero heading on each page. Everything above the fold serves it.
ACTION: The primary button in the hero (start a project), repeated in the header CTA and in the
        closing band or contact section.
QUIET:  Secondary buttons, the footer, metadata on post cards.
```

## Implementation Plan

Six phases. Each ends in a state that runs and is committed on its own. Phase 2 is the smallest result that answers the brief; everything after it widens the proof.

### Phase 0: the repository runs

1. Pin `payload` and every `@payloadcms/*` package to `4.0.0-beta.0`, the release the base commit was written against (`@payloadcms/transformer-sharp` exists only in 4.x); `pnpm install`; commit the lockfile.
2. Set the Dockerfile base image to a Node 24 tag so it satisfies the `engines` field; `.nvmrc` says `24.15.0`.
3. `pnpm dev` serves the stock template; log in to the admin; seed; the stock home page renders.
4. `pnpm lint`, `pnpm build`, `pnpm test:int` pass as a baseline.

### Phase 1: schemas and compiler

1. `src/engine/schema/`: zod schemas for theme, section, global and seed files; `toJsonSchema()`.
2. `src/engine/compiler/`: load with positions, validate, normalise, resolve, emit; the CLI with `--watch`, `--check` and `--strict`.
3. `templates/` written far enough to compile: theme, header, footer, `hero-split`.
4. `tests/int/engine/compiler.int.spec.ts` with the broken-fixture suite, the `valid-minimal` fixture and the snapshot of the generated files.
5. Scripts, `.gitignore`, `templates/schema.json`.

**Proof:** `pnpm sections:compile` writes the six files; a deliberately broken section fails with a positioned, hinted message; `pnpm sections:check` passes.

### Phase 2: renderer and the first generated page

1. `src/engine/render/` and the primitives `Text`, `RichText`, `Image`, `Icon`, `Button`, `Container`, `Each`.
2. `src/engine/payload/`: `iconField`, `linkField`, `rowLabel`, `RowLabel.tsx`, the icon components; `pnpm generate:importmap`.
3. `Pages.layout` mounts the generated `blocks`; `generate:types`.
4. `[slug]/page.tsx` renders `RenderSections` for generated block types (the stock `RenderBlocks` still handles the stock ones in this phase) and falls back to the seed's home sections on an unseeded database.
5. `tests/int/engine/renderer.int.spec.ts` for the primitives, scope and conditions.

**Proof:** in the admin, add a Split hero to a page, fill it in, publish; it renders on the page and updates in live preview. No component was written for it. This is the single-section answer to the brief.

### Phase 3: the site: theme, globals, the section library and its seed

1. `theme.css` and `fonts.ts` emission; `globals.css` gains `@source` and the `--font-heading` slot; `layout.tsx` imports both and mounts `RenderGlobal` for header and footer.
2. `globals.ts` emission with `revalidateGlobal`; `payload.config.ts` uses the generated globals. `siteName` from the theme feeds the metadata, Open Graph and the seed button; `colorMode` reaches the frontend's theme script through the manifest.
3. `Form` primitive from the stock `FormBlock`; `List` primitive with `select` derivation, `where` placeholders and the synthetic `url`.
4. The sixteen sections of [demo-site.md](demo-site.md), in their five drawer groups.
5. `src/engine/seed/` reading `templates/seed/`; the four pages, the globals, the two forms and the media; the demo posts under `src/engine/seed/`; the seed endpoint calls `seedSite`.

**Proof:** the seed button produces the whole Studio site: Home, Services, About and Contact render every section from config; both forms submit and their submissions appear in the admin; latest posts render from the Posts collection and filter by category; editing the header global revalidates the site.

### Phase 4: removal of the stock blocks

1. Remove the hand-written page blocks, heroes, header, footer and seed documents listed in [payload-integration.md section 7](payload-integration.md#7-removal-in-the-last-phase), in a commit of their own so the removal can be reverted alone.
2. `generate:types` and `generate:importmap`; the build passes with nothing but generated blocks on Pages.

**Proof:** `git grep` finds no import of a removed file; every seeded page renders as before.

### Phase 5: polish

1. The end-to-end suite: seed through the endpoint, load `/`, check the hero heading, the header and footer, and submit the form.
2. `README.md` at the repository root: what this is, how to run it, how to add a section, where the spec lives.
3. The spec reconciled with the code: every name, path, command and error text checked against the source.

**Proof:** the acceptance test in R8 holds on a fresh section added under `templates/sections/` without touching `src/`, and the verification checklist below is ticked.

## Files Likely Affected

- `templates/**` (new), `templates/schema.json` (generated, committed)
- `src/engine/**` (new), `src/generated/**` (ignored), `public/sections/**` (ignored)
- `src/collections/Pages/index.ts`, `src/payload.config.ts`
- `src/app/(frontend)/layout.tsx`, `src/app/(frontend)/[slug]/page.tsx`, `src/app/(frontend)/globals.css`
- `src/endpoints/seed/index.ts`
- the site-name consumers and the theme providers listed in BLAST
- `src/payload-types.ts`, `src/app/(payload)/admin/importMap.js`
- `package.json`, `pnpm-lock.yaml`, `.gitignore`, `Dockerfile`
- `tests/int/engine/**`, `tests/fixtures/templates/**`, `tests/e2e/**`
- removals in phase 4 as listed in BLAST

## Development Checklist

- [x] Phase 0: dependencies pinned, Dockerfile base set, stock template runs, baseline checks pass
- [x] Phase 1: schemas, compiler, CLI, `templates/` compiles, broken-fixture suite, output snapshot, `schema.json`
- [x] Phase 2: renderer, seven primitives, Payload helpers, Pages on generated blocks, a generated hero editable and live-previewed
- [x] Phase 3: theme.css, fonts.ts, generated globals, `siteName` and `colorMode`, Form and List primitives, the sixteen sections, the four-page seed
- [x] Phase 4: stock blocks, heroes, header, footer and seed documents removed
- [x] Phase 5: e2e suite, root README, spec reconciled with the code

## Verification Checklist

- [x] `pnpm sections:check` passes with `--strict`
- [x] `pnpm test:int` passes: 91 tests in 5 files (compiler fixtures, snapshots, renderer, seeder)
- [x] `pnpm test:e2e` passes: 7 tests in 3 files. Sections (3): seed, the home hero heading, the header and footer, a contact form submission. Admin Panel (3). Frontend (1): a post page
- [ ] `pnpm lint`, `tsc --noEmit` and `pnpm build` pass
- [ ] Every seeded page renders and both forms' submissions are in the admin; every section lists in the admin's add-block drawer under its group with its label and fields; Live Preview renders the page beside the form
- [ ] R8 acceptance: a section added under `templates/sections/` compiles, appears in the admin's drawer under its group, and `git status` shows nothing under `src/`
- [ ] R9 lean output: compiler test "list select derivation"; the renderer tests for empty values rendering nothing; a generated block declares only the section's fields (the compiler snapshots)
- [x] No attribution trailers in any commit message

## Open Issues

- **Payload is a 4.0 pre-release.** The template snapshot imports `@payloadcms/transformer-sharp`, which has no 3.x release, so the project pins `4.0.0-beta.0`. Everything this spec relies on (`select` on find, block `interfaceName`, component paths with `clientProps`, Lexical, the form-builder plugin) is the same in 3.x and 4.0. TypeScript 6 rejects a slug-typed `CollectionConfig<'pages'>` whose `defaultPopulate` is passed to `buildConfig`, so the Pages config is untyped by slug; the note in `src/collections/Pages/index.ts` explains it.
- **Node.** The Dockerfile base is `node:24-alpine` and `engines` requires 24.15. The project also runs on Node 22.15; a clean install on Node 24 is the supported path.
- **Fonts at build time.** `next/font/google` downloads at build; an offline build fails. Local font files under `templates/assets/fonts/` with a `next/font/local` loader is the natural extension and is out of scope.
- **List revalidation.** Publishing a post does not revalidate pages that list posts. Fix: an `afterChange` on Posts calling `revalidateTag('sections:posts')` and that tag on the `List` query.
- **Mobile navigation.** The Studio header has no mobile menu; it hides the nav below `md`. The `details` container tag and the `summary` text tag, which the FAQ section uses, are enough for a config-only menu in `header.yaml`; that menu is the follow-up.
- **Lexical is bundled once per Next server layer.** `getPayload` caches one instance for every layer, so a route handler that converts Markdown with editors taken from `payload.config` fails with "is not a constructor that subclasses LexicalNode" once the admin layer has initialised. The seeder builds its converter from the `config` its caller imports (`editorConfigFactory.fromField`), and the seed route passes its own. Any new server-side Lexical conversion needs the same care.
- **Media files on reseed.** The seeder clears collections through the database adapter, so the documents go but the files under `public/media/` stay, and the next seed uploads them again with `-1`, `-2` suffixes, as the stock seed does. Harmless locally; a deployment that reseeds would clear the folder first.
- **Playwright and the tsx loader.** `test:e2e` runs Playwright under `--import=tsx/esm`, which conflicts with Playwright 1.63's own TypeScript ESM loader, so the script also sets `PW_DISABLE_TS_ESM=1`.
- **The e2e web server's own Node options.** Playwright starts the site with `pnpm build && pnpm start` and gives that command `NODE_OPTIONS=--no-deprecation` alone. pnpm 11 fails under `--import=tsx/esm` before the build starts (it reports a missing `.pnpmfile.mjs`), so the loader the test runner needs must not reach the web server; with it, the suite runs only against a site that is already up.
- **The Sections suite runs first and alone.** `tests/e2e/sections.e2e.spec.ts` is its own Playwright project, `sections`, and the `chromium` project (Admin Panel and Frontend) depends on it. Seeding clears the content collections and the suite signs in as the shared test user, so it cannot run beside the other suites.
- **Browser binary for e2e.** Playwright 1.63 wants Chromium build 1243. On a network where `playwright install chromium` times out against the Playwright CDN, the same archive from a public mirror, unpacked into Playwright's browsers folder, works.
- **`AGENTS.md`.** `next dev` on Next 16 appends a `nextjs-agent-rules` block to `AGENTS.md`. It is committed as Next writes it; `agentRules: false` in `next.config.ts` turns the behaviour off.
- **Seed types shim.** `src/engine/seed/types.ts` only re-exports the seed schema's inferred types under the seeder's names. Callers could import from `src/engine/schema/seed.ts` directly and the file could go.

## Current Status

Phases 0 to 5 are done: the Studio site compiles from `templates/` alone, with sixteen sections seeded into Home, Services, About and Contact. The integration suite (91 tests) and the end-to-end suite (7 tests) pass. Of the open issues, list revalidation and mobile navigation are the two a real site would want first.
