# Build Plan

Part of the [Sections Engine Specification](README.md). This is the working plan for the implementation: the requirements the work is graded against, the change intent, the phases, and the checklists that get ticked as the work lands.

## Requirements

Derived from [ASSIGNMENT.md](../ASSIGNMENT.md) and the decisions in [decisions.md](decisions.md).

- **R1** A declarative template format that states a section's fields, layout and styling, with explicit nesting and repeatable groups, validated with errors that name the file, position and fix.
- **R2** Any number of templates, each a folder under `templates/`, discovered without code changes.
- **R3** A compiler that turns a template into Payload block and global configs and a render plan, and from which TypeScript types follow through `payload generate:types`.
- **R4** A renderer that draws any compiled section from its plan with no per-section component.
- **R5** Editors pick a section in the admin, fill it in, place and reorder it on a page, and the site renders it, with drafts, preview and live preview working.
- **R6** A template is a whole site face: theme, header, footer and sections. Two faces, `template-1` and `template-2`, built from config alone and seeded so they show on a page.
- **R7** Behaviour is config-driven too: forms submit through the form-builder plugin and lists are fed from collections, both declared in YAML.
- **R8** Acceptance test: adding a section, redesigning one, or adding a face adds or edits files under `templates/` only. No `.ts` or `.tsx`.
- **R9** Lean output: a block has only the fields its section declares; markup is only what the layout asks for; queries select only what is referenced.
- **R10** TypeScript throughout; the project lints, type-checks, builds and its tests pass.
- **R11** The repository installs and runs from a clean clone (the base pins Payload at `workspace:*`, which does not install).
- **R12** Decisions and trade-offs are written down ([decisions.md](decisions.md)).

## Change Intent

```text
CONTRACT:  Pages compose from blocks generated out of templates/<SITE_TEMPLATE>/; the header, footer,
           fonts and colour tokens come from the same template; the frontend renders all of it through
           one generic renderer. Posts, media, categories, forms, search, redirects, SEO, auth and the
           admin keep their current behaviour.
BLAST:     src/engine/** (new); src/generated/** (new, ignored); templates/** (new);
           src/collections/Pages/index.ts (hero tab, layout blocks); src/payload.config.ts (globals);
           src/app/(frontend)/layout.tsx, [slug]/page.tsx, globals.css; src/endpoints/seed/**;
           package.json, pnpm-lock.yaml, .gitignore, .nvmrc, Dockerfile (node base);
           src/payload-types.ts, src/app/(payload)/admin/importMap.js (regenerated);
           phase 5 only: removal of src/blocks/{ArchiveBlock,CallToAction,Content,Form/config.ts,
           RenderBlocks.tsx}, src/heros/{config.ts,HighImpact,MediumImpact,LowImpact,RenderHero.tsx},
           src/Header/**, src/Footer/**, src/components/{CollectionArchive,Card}.
           NOT src/collections/{Posts,Media,Categories,Users}, NOT src/plugins, NOT src/providers,
           NOT src/components/{Media,RichText,Link,ui}, NOT the post page.
PRECEDENT: src/Header/config.ts (global shape, link() usage, RowLabel path, afterChange revalidate);
           src/blocks/Form/Component.tsx (form submission flow); src/utilities/getGlobals.ts (cached
           global read); src/endpoints/seed/index.ts (clear-then-create seeding).
RISK:      none of data loss, authz or public API. Build-time: next/font/google needs network at build.
           Content: switching templates leaves unknown block types in existing pages (reseed clears).
ROLLBACK:  revert-only; no migrations (MongoDB), no schema outside Payload config.
VERIFY:    pnpm sections:check; pnpm test:int; pnpm lint; pnpm build; then for each template:
           SITE_TEMPLATE=<t> pnpm dev, seed from the admin, open /, edit a section in the admin and see
           it live-preview, submit the form and find the submission in the admin.
```

## Design Intent

For the two demo faces; the engine itself has no UI.

```text
MODE:   Persuade. Both faces are marketing sites whose job is to make a visitor act.
LEAD:   The hero heading. Everything above the fold serves it.
ACTION: The primary button in the hero (Studio: start a project; Launch: get started), repeated in the
        header CTA and the closing band or contact section.
QUIET:  Secondary buttons, the footer, metadata on post cards, the theme selector.
```

## Implementation Plan

Six phases. Each ends in a state that runs and is committed on its own. Phase 2 is the smallest result that answers the brief; everything after it widens the proof.

### Phase 0: the repository runs

1. Pin `payload` and every `@payloadcms/*` package to `4.0.0-beta.0`, the release the base commit was written against (it is 35 minutes younger than that publish, and `@payloadcms/transformer-sharp` exists only in 4.x); `pnpm install`; commit the lockfile.
2. Bump the Dockerfile base image to a Node 24 tag so it satisfies the `engines` field; `.nvmrc` already says `24.15.0`.
3. `pnpm dev` serves the stock template; log in to the admin; seed; the stock home page renders.
4. `pnpm lint`, `pnpm build`, `pnpm test:int` pass as a baseline.

### Phase 1: schemas and compiler

1. `src/engine/schema/`: zod schemas for manifest, theme, section, global, seed files; `toJsonSchema()`.
2. `src/engine/compiler/`: load with positions, validate, resolve, normalise, emit; the CLI with `--template`, `--watch`, `--check`, `--all`, `--strict`.
3. `templates/template-1/` written far enough to compile: manifest, theme, header, footer, `hero-split`.
4. `tests/int/engine/compiler.int.spec.ts` with the broken-fixture suite and the snapshot of template-1's output.
5. Scripts, `.gitignore`, `templates/schema.json`.

**Proof:** `pnpm sections:compile` writes the six files; a deliberately broken section fails with a positioned, hinted message; `pnpm sections:check` passes.

### Phase 2: renderer and the first generated page (MVP)

1. `src/engine/render/` and the primitives `Text`, `RichText`, `Image`, `Icon`, `Button`, `Container`, `Each`.
2. `src/engine/payload/`: `iconField`, `rowLabel`, `RowLabel.tsx`, `icons.ts`; `pnpm generate:importmap`.
3. `Pages.layout` mounts the generated `blocks`; `generate:types`.
4. `[slug]/page.tsx` renders `RenderSections` for generated block types (the stock `RenderBlocks` still handles the stock ones in this phase).
5. `tests/int/engine/renderer.int.spec.ts` for the primitives, scope and conditions.

**Proof:** in the admin, add a Split hero to a page, fill it in, publish; it renders on the page and updates in live preview. No component was written for it.

### Phase 3: theme and globals

1. `theme.css` and `fonts.ts` emission; `globals.css` gains `@source` and the `--font-heading` slot; `layout.tsx` imports both and mounts `RenderGlobal` for header and footer.
2. `globals.ts` emission with `revalidateGlobal`; `payload.config.ts` uses the generated globals.
3. Template-1's remaining sections: `features`, `testimonial`, `contact` (form field only; the primitive lands in phase 4).

**Proof:** template-1 is a complete face with no hand-written header, footer, font or colour; editing the header global revalidates the site.

### Phase 4: behaviour and seeding

1. `Form` primitive from the existing `FormBlock`; `List` primitive with `select` derivation, `where` placeholders and the synthetic `url`.
2. `latest-posts` section; the `category` relation and its `where` placeholder.
3. `src/engine/seed/` reading `templates/<t>/seed/`; template-1's seed files and media; the seed endpoint calls it.

**Proof:** the contact form submits and the submission appears in the admin; latest posts render from the Posts collection and filter by category; the Seed button produces the whole Studio site.

### Phase 5: second face, switching, removal, documentation

1. `templates/template-2/` complete with seed.
2. `SITE_TEMPLATE` switching verified both ways, including the data notes in [payload-integration.md section 7](payload-integration.md#7-switching-templates).
3. Remove the hand-written page blocks, heroes, header, footer and seed documents listed in [payload-integration.md section 8](payload-integration.md#8-removal-in-the-last-phase); move posts seed to the engine.
4. Snapshot tests for template-2; an e2e test per face that seeds, loads `/`, checks the hero heading and submits the form.
5. `README.md` at the repository root: what this is, how to run it, how to add a section and a face, where the spec lives.

**Proof:** both faces build and render from config; the acceptance test in R8 holds on a fresh section added to each face without touching `src/`.

## Files Likely Affected

- `templates/**` (new), `templates/schema.json` (generated, committed)
- `src/engine/**` (new), `src/generated/**` (ignored), `public/sections/**` (ignored)
- `src/collections/Pages/index.ts`, `src/payload.config.ts`
- `src/app/(frontend)/layout.tsx`, `src/app/(frontend)/[slug]/page.tsx`, `src/app/(frontend)/globals.css`
- `src/endpoints/seed/index.ts`
- `src/payload-types.ts`, `src/app/(payload)/admin/importMap.js`
- `package.json`, `pnpm-lock.yaml`, `.gitignore`, `Dockerfile`
- `tests/int/engine/**`, `tests/fixtures/templates/**`, `tests/e2e/**`
- removals in phase 5 as listed in BLAST

## Development Checklist

- [x] Phase 0: dependencies pinned, Dockerfile base bumped, stock template runs, baseline checks pass
- [x] Phase 1: schemas, compiler, CLI, template-1 compiles, broken-fixture suite, output snapshot, `schema.json`
- [x] Phase 2: renderer, seven primitives, Payload helpers, Pages on generated blocks, a generated hero editable and live-previewed
- [x] Phase 3: theme.css, fonts.ts, generated globals mounted, template-1 complete as a face
- [x] Phase 4: Form and List primitives, latest-posts, generic seeder, template-1 seed
- [x] Phase 5: template-2 and seed, switching verified, hand-written blocks and heroes removed, e2e per face, root README

## Verification Checklist

- [x] `pnpm sections:check` passes for both templates with `--strict` (`template-1: ok`, `template-2: ok`)
- [ ] `pnpm test:int` passes: compiler fixtures, snapshots, renderer, seeder. 96 tests in 5 files. The compiler, renderer, seeder and Lexical suites are green; the three template-2 snapshot tests compare the shipped folder with its committed output, so they fail while any scratch section sits under `templates/template-2/sections/`. Tick after a run on the folder as committed.
- [x] `pnpm lint` (0 errors, 8 stock warnings), `tsc --noEmit` and `pnpm build` pass with each template active
- [x] Both faces: seed, home renders, form submits and the submission is in the admin (the `Sections` e2e suite, 7 of 7 per face); every section of the Launch home lists under Layout in the admin with its label and its fields; Live Preview renders the page beside the form
- [x] R8 acceptance: a `quote-band.yaml` added under `templates/template-2/sections/` compiled, appeared in the admin's Add Layout drawer under its group, and `git status` showed nothing under `src/`
- [x] R9 lean output: compiler test "list select derivation: selects exactly what the children reference, plus slug for url"; renderer tests "text with %j renders nothing", "image with an unpopulated upload renders nothing", "button with an empty link or no label renders nothing"; a generated block declares only the section's fields (the template snapshots)
- [x] No attribution trailers in any commit message

## Open Issues

- **Payload is a 4.0 pre-release.** The template snapshot imports `@payloadcms/transformer-sharp`, which has no 3.x release, so the project pins `4.0.0-beta.0` rather than patching the template back to 3.x. Everything this spec relies on (`select` on find, block `interfaceName`, component paths with `clientProps`, Lexical, the form-builder plugin) is unchanged between 3.x and 4.0. One thing moved at install time: TypeScript 6 rejects a slug-typed `CollectionConfig<'pages'>` whose `defaultPopulate` is passed to `buildConfig`, so the Pages config drops the generic; the note in `src/collections/Pages/index.ts` explains it.
- **Node.** The Dockerfile base is `node:24-alpine` (done in phase 0). The work itself ran on Node 22.15, below the `engines` floor of 24.15; nothing failed, and the floor stands. A clean install on Node 24 is the supported path.
- **Tailwind source scope.** Kept broad: `globals.css` scans `../../../templates`, so both faces' utilities are compiled into one stylesheet. Narrowing to the active face is still a follow-up.
- **Fonts at build time.** `next/font/google` downloads at build; an offline build fails. Local font files under `templates/<t>/assets/fonts/` with a `next/font/local` loader is the natural extension and is out of scope.
- **List revalidation.** Still open. Publishing a post does not revalidate pages that list posts. Fix: an `afterChange` on Posts calling `revalidateTag('sections:posts')` and that tag on the `List` query. Not done in phase 4.
- **Default colour mode.** `theme.yaml` declares a `light` and a `dark` set but not which one a first-time visitor gets; the stock `InitTheme` script decides (saved choice, else system preference, else light). A face "designed dark" therefore shows its light set to a light-OS visitor. The follow-up is an optional `defaultMode` in the theme file, emitted as a generated constant that `InitTheme` reads ahead of the system preference; it touches `src/providers/Theme`, which this plan otherwise leaves alone, so it is out of scope.
- **Mobile navigation.** The generated header has no client-side menu. A config-only `details`/`summary` disclosure, or a `nav` primitive with a built-in toggle, is the follow-up.
- **Unknown block types after a switch.** Pages authored under the other template keep rows the active config cannot edit. The demo reseeds; a real deployment would pin a template per environment.
- **Unseeded home page.** Done in phase 2: `[slug]/page.tsx` falls back to the rows of the active template's `seed/pages.yaml` when no `home` page exists, so a fresh database shows the face before the first seed. The stock `home-static` is gone.
- **Lexical is bundled once per Next server layer.** `getPayload` caches one instance for every layer, so a route handler that converts Markdown with editors taken from `payload.config` fails with "is not a constructor that subclasses LexicalNode" once the admin layer has initialised. The seeder therefore builds its converter from the `config` its caller imports (`editorConfigFactory.fromField`), and the seed route passes its own. Any new server-side Lexical conversion needs the same care.
- **Media files on reseed.** The seeder clears collections through the database adapter, so the documents go but the files under `public/media/` stay, and the next seed uploads them again with `-1`, `-2` suffixes. This is how the template's own seed behaved; harmless locally, and a deployment that reseeds would clear the folder first.
- **Playwright and the tsx loader.** `test:e2e` has always run Playwright under `--import=tsx/esm`. With Playwright 1.63 that hook conflicts with Playwright's own TypeScript ESM loader and the config fails to load, so the script also sets `PW_DISABLE_TS_ESM=1`.
- **Browser binary for e2e.** Playwright 1.63 wants Chromium build 1243. `playwright install chromium` timed out against the Playwright CDN on the network the work was done on; the same archive from a public mirror, unpacked into Playwright's browsers folder, works. A normal network will not see this.
- **`AGENTS.md`.** `next dev` on Next 16 appends a `nextjs-agent-rules` block to `AGENTS.md`. It is committed as Next wrote it; `agentRules: false` in `next.config.ts` turns the behaviour off.
- **Seed types shim.** `src/engine/seed/types.ts` only re-exports the seed schema's inferred types under the seeder's names. Callers could import from `src/engine/schema/seed.ts` directly and the file could go.

## Current Status

Built. Specification written 2026-10-12 against the base commit (Payload website template at upstream `b103a85`); all six phases landed on `dev` by 2026-10-13. Both faces compile under `--strict`, build, seed from the admin, render, submit their form and pass the e2e suite. The stock page blocks, heroes, header, footer and seed documents are removed in their own commit so the removal can be reverted on its own.

Verified on 2026-10-13: the checklists above. Still to do, in order: run `pnpm test:int` on the templates folder exactly as committed and tick its line; push `dev`; then the open issues above, of which list revalidation and the mobile navigation are the two a real site would want first.
