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

- [ ] Phase 0: dependencies pinned, Dockerfile base bumped, stock template runs, baseline checks pass
- [ ] Phase 1: schemas, compiler, CLI, template-1 compiles, broken-fixture suite, output snapshot, `schema.json`
- [ ] Phase 2: renderer, seven primitives, Payload helpers, Pages on generated blocks, a generated hero editable and live-previewed
- [ ] Phase 3: theme.css, fonts.ts, generated globals mounted, template-1 complete as a face
- [ ] Phase 4: Form and List primitives, latest-posts, generic seeder, template-1 seed
- [ ] Phase 5: template-2 and seed, switching verified, hand-written blocks and heroes removed, e2e per face, root README

## Verification Checklist

- [ ] `pnpm sections:check` passes for both templates with `--strict`
- [ ] `pnpm test:int` passes: compiler fixtures, snapshots, renderer, seeder
- [ ] `pnpm lint`, type check and `pnpm build` pass with each template active
- [ ] Both faces: seed, home renders, each section editable in the admin, live preview updates, form submits and the submission is in the admin
- [ ] R8 acceptance: a new section added to each face under `templates/` only, visible in the admin and on a page, with `git status` showing no change under `src/`
- [ ] R9 lean output: a generated block's fields equal the section's fields; a `list` query's `select` equals its referenced fields; rendered HTML for an empty optional field contains no element for it
- [ ] No attribution trailers in any commit message

## Open Issues

- **Payload is a 4.0 pre-release.** The template snapshot imports `@payloadcms/transformer-sharp`, which has no 3.x release, so the project pins `4.0.0-beta.0` rather than patching the template back to 3.x. Everything this spec relies on (`select` on find, block `interfaceName`, component paths with `clientProps`, Lexical, the form-builder plugin) is unchanged between 3.x and 4.0; any API that moved is found at install time and recorded here.
- **Node base image.** The Dockerfile uses `node:22.17.0-alpine`; `engines` requires `>=24.15.0`. Phase 0 bumps it.
- **Tailwind source scope.** `@source "../../../templates"` compiles both faces' utilities. Narrowing to the active template needs the directive in a generated file; try `@source` inside the generated `theme.css` imported from `globals.css` and keep the broad directive if it is not honoured there.
- **Fonts at build time.** `next/font/google` downloads at build; an offline build fails. Local font files under `templates/<t>/assets/fonts/` with a `next/font/local` loader is the natural extension and is out of scope.
- **List revalidation.** Publishing a post does not revalidate pages that list posts. Fix: an `afterChange` on Posts calling `revalidateTag('sections:posts')` and that tag on the `List` query. Small; do it if phase 4 has room.
- **Default colour mode.** `theme.yaml` declares a `light` and a `dark` set but not which one a first-time visitor gets; the stock `InitTheme` script decides (saved choice, else system preference, else light). A face "designed dark" therefore shows its light set to a light-OS visitor. The follow-up is an optional `defaultMode` in the theme file, emitted as a generated constant that `InitTheme` reads ahead of the system preference; it touches `src/providers/Theme`, which this plan otherwise leaves alone, so it is out of scope.
- **Mobile navigation.** The generated header has no client-side menu. A config-only `details`/`summary` disclosure, or a `nav` primitive with a built-in toggle, is the follow-up.
- **Unknown block types after a switch.** Pages authored under the other template keep rows the active config cannot edit. The demo reseeds; a real deployment would pin a template per environment.
- **`home-static` fallback.** Replaced by a seed-derived fallback in phase 2; until then an unseeded database shows the stock static home.

## Current Status

Not started. Specification written 2026-10-12 against the base commit (Payload website template at upstream `b103a85`). Next: phase 0.
