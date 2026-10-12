# Payload Integration

Part of the [Sections Engine Specification](README.md). This document records what the stock Payload website template does, file by file, and exactly what the engine changes so the generated blocks, globals, theme and seeds take over.

## 1. The stock template

Anchors are at the base commit (Payload website template, upstream `b103a85`).

| File | What the stock file does | Relevance |
| --- | --- | --- |
| `src/collections/Pages/index.ts:10`, `:69` | imports `hero` from `@/heros/config` and mounts it as the Hero tab | the Hero tab goes; a hero is a section |
| `src/collections/Pages/index.ts:77` | `blocks: [CallToAction, Content, MediaBlock, Archive, FormBlock]` on the `layout` field | becomes the generated `blocks` |
| `src/collections/Pages/index.ts:43` | `livePreview` per page | unchanged |
| `src/blocks/RenderBlocks.tsx:11`, `:37` | maps `blockType` to a component; wraps every block in `<div className="my-16">` | replaced by `RenderSections`; the wrapper goes |
| `src/app/(frontend)/[slug]/page.tsx:77-78` | `<RenderHero {...hero} />` then `<RenderBlocks blocks={layout} />` | one `RenderSections` call |
| `src/app/(frontend)/layout.tsx:4-5`, `:16`, `:37-39` | Geist font variables; imports `globals.css`; renders `<Header />`, children, `<Footer />` | theme.css, generated fonts, `RenderGlobal` |
| `src/Header/config.ts:16`, `:24`, `:30` | `navItems` array of `link({ appearances: false })`, a `RowLabel` component path, `afterChange: [revalidateHeader]` | the pattern the generated globals follow |
| `src/Footer/config.ts` and both `Component*.tsx` | same shape for the footer | replaced |
| `src/utilities/getGlobals.ts:24` | `getCachedGlobal(slug, depth)` with cache tag `global_<slug>` | reused by `RenderGlobal` |
| `src/fields/link.ts:24` | `link({ appearances, disableLabel, overrides })` returning a group field | reused for every `link` field |
| `src/fields/defaultLexical.ts` | the Lexical editor config | reused for `richText` |
| `src/blocks/Form/Component.tsx:1`, `:66` | `'use client'`; posts to `/api/form-submissions` | becomes the `Form` primitive |
| `src/plugins/index.ts:57` | `formBuilderPlugin` with payment off and a Lexical confirmation message | unchanged |
| `src/collections/Posts/index.ts:94` | `BlocksFeature({ blocks: [Banner, Code, MediaBlock] })` in the post body | these three blocks stay |
| `src/app/(frontend)/globals.css:6`, `:40-47`, `:90`, `:128` | dark variant on `[data-theme='dark']`; `@theme` with `--font-sans: var(--font-geist-sans)`; light tokens; dark tokens | the token slots the theme fills |
| `src/endpoints/seed/index.ts:31` | `seed()` clears collections and globals, then creates media, posts, a form, pages and the globals | replaced by the generic seeder; the clearing logic is kept |
| `src/components/BeforeDashboard/SeedButton` | admin button calling the seed endpoint | calls the generic seeder; labelled with the site name |
| `src/payload.config.ts:86` | `globals: [Header, Footer]` | the generated `globals` |
| `.gitignore` | no entry for generated code | add `src/generated/` and `public/sections/` |

## 2. Principles

- The engine is additive until the removal phase. The stock blocks and heroes keep compiling and rendering while generated sections are built next to them; they are removed once the section library covers every demo page ([build-plan.md](build-plan.md), phase 4).
- Content stays in Payload. Pages, posts, media, forms and submissions are ordinary documents; the engine changes what fields a page block has, not where anything is stored.
- Every import of generated code is from `@/generated/sections/*`, in a hand-written file, written once.

## 3. Changes by file

### `src/collections/Pages/index.ts`

- Remove the Hero tab and the `hero` import. The Content tab becomes the first tab.
- `layout.blocks` imports `blocks` from `@/generated/sections/blocks`.
- `admin.defaultColumns`, `slug`, SEO tab, versions, drafts, live preview, hooks: unchanged.

### `src/payload.config.ts`

- `globals: globals` from `@/generated/sections/globals` instead of `[Header, Footer]`.
- Everything else unchanged. `typescript.outputFile` keeps `src/payload-types.ts`.

### `src/app/(frontend)/layout.tsx`

```tsx
import './globals.css'
import '@/generated/sections/theme.css'
import { fontVariables } from '@/generated/sections/fonts'
import { RenderGlobal } from '@/engine/render/RenderGlobal'
// ...
<html className={cn(fontVariables, GeistMono.variable)} lang="en" suppressHydrationWarning>
  <body>
    <Providers>
      <AdminBar ... />
      <RenderGlobal slug="header" />
      {children}
      <RenderGlobal slug="footer" />
    </Providers>
  </body>
</html>
```

### `src/app/(frontend)/[slug]/page.tsx`

- Drop `RenderHero` and the `hero` destructure; render `<RenderSections blocks={layout} />`.
- An unseeded home page renders `getHomeFallback(templatesDir, manifest)`: the home page's sections read from `templates/seed/pages.yaml`, so the fallback is also config.

### `src/app/(frontend)/globals.css`

- Add `@source "../../../templates";` beside the existing `@source inline(...)` lines ([compiler.md section 9](compiler.md#9-tailwind)).
- Add `--font-heading: var(--font-sans);` inside the first `@theme` block so `font-heading` exists.
- Nothing is removed; the stock tokens are the defaults the theme inherits.

### Site name

The theme's `siteName` comes through the generated manifest. It is the title suffix in `src/plugins/index.ts` (the SEO plugin), `src/utilities/generateMeta.ts` and the posts and search page titles, the Open Graph site name in `src/utilities/mergeOpenGraph.ts`, and the seed button's label ("Seed your database with Studio").

### Colour mode

The theme's `colorMode` comes through the generated manifest too (`COLOR_MODES` and `ColorMode` in `src/engine/manifest.ts`; the compiler fills in `system` when the theme sets none). `src/app/(frontend)/layout.tsx` reads `manifest.colorMode` and passes it to `InitTheme` and to `Providers`, which hands it to `ThemeProvider`:

- `src/providers/Theme/InitTheme/index.tsx`: the before-paint script takes a `colorMode` prop. `light` or `dark` is set outright; `system` uses a stored choice when there is one, else the device setting.
- `src/providers/Theme/index.tsx`: `ThemeProvider` takes the same prop and its effect follows the same order.
- `src/providers/index.tsx`: passes the prop through.

`HeaderTheme` and the rest of `src/providers` are unchanged. There is no admin setting and no visitor switch.

### `src/engine/payload/`

Hand-written helpers the generated config imports:

- `fields.ts`: `iconField(name, options)`, `linkField(name, options)` and `rowLabel(field)`.
- `iconComponents.ts`: the map from the curated icon names in `src/engine/icons.ts` to the `lucide-react` components the `Icon` primitive renders.
- `RowLabel.tsx`: one client component reading `useRowLabel()` and `clientProps.field`, replacing the two per-global row labels.
- `revalidateGlobal.ts`: the `afterChange` factory.

After adding `RowLabel.tsx`, `pnpm generate:importmap` once; the path is fixed, so the import map does not change when sections change.

### `src/endpoints/seed/`

- `index.ts` keeps its clearing logic (categories, media, pages, posts, forms, form submissions, search results and their versions) and calls `seedSite({ payload, req, templatesDir, manifest, config })` from `src/engine/seed/` with `templatesDir` set to `<repo>/templates`. `config` is the route handler's own awaited `@payload-config`, not `payload.config`: Next.js bundles `lexical` once per server layer and `getPayload` caches one instance for all of them, so the editors on the cached instance usually belong to the admin layer's copy and the route layer's headless editor rejects their node classes. The seeder writes everything with `disableRevalidate`; the endpoint then revalidates the `global_<slug>` tags, both sitemap tags and `revalidatePath('/', 'layout')`, so the cached globals and any prerendered page pick up the seed.
- `src/engine/seed/` reads `templates/seed/*.yaml` (`loadSiteSeed(templatesDir)`), plans the work (`planSeed(templatesDir, manifest, postsDir?)`), uploads `templates/seed/media/*` with `payload.create({ collection: 'media', filePath })`, creates forms, creates pages in two passes (first without link references, then updates them), then sets the globals. Every section's data is validated against the section's fields before writing; a section name in `pages.yaml` that does not exist is reported as `"<name>" is not a section; the sections are <list>`. Markdown in the seed becomes rich text through the target field's own editor (`editorConfigFactory.fromField`), so a value only holds nodes that field supports.
- The demo posts and their images are `src/engine/seed/posts.yaml` and `src/engine/seed/media/`: posts are not sections, so they live with the engine rather than under `templates/`.
- The seed log reads `Seeding database with Studio...`, then a line per step.

### `package.json`, `.gitignore`

- Scripts from [compiler.md section 3](compiler.md#3-command-line); `yaml` and `zod` are dependencies.
- Ignore `src/generated/` and `public/sections/`.

## 4. Types

`pnpm generate:types` after every compile. Each block gets its `interfaceName`, so `Page['layout'][number]` is a union of `HeroSplitBlock | FeaturesBlock | ...`, and the globals are `Header` and `Footer`. `src/payload-types.ts` stays committed; a change to a section's fields changes it, which is visible in review and expected.

The renderer does not depend on these types (it works on the plan and plain data); they exist for the admin, the Local API and anyone writing code against the site.

## 5. Revalidation

- Pages: the existing `revalidatePage` and `revalidateDelete` hooks on the Pages collection, unchanged.
- Globals: `revalidateGlobal(slug)` revalidates `global_<slug>`, the tag `getCachedGlobal` sets.
- Lists: a published post does not revalidate pages that list posts. Accepted for the demo; recorded in [build-plan.md](build-plan.md) under open issues with the fix (a `revalidateTag('sections:posts')` hook on Posts and that tag on the `List` query).

## 6. Drafts, preview and live preview

Unchanged. Generated blocks are ordinary block fields, so autosave, versions, draft preview and live preview behave as they do for the stock blocks. `generatePreviewPath` and `LivePreviewListener` are untouched.

## 7. Removal in the last phase

Goes, because generated sections cover it:

- `src/blocks/ArchiveBlock`, `CallToAction`, `Content`, `Form` and `RenderBlocks.tsx`.
- `src/heros/config.ts`, `HighImpact`, `MediumImpact`, `LowImpact`, `RenderHero.tsx`.
- `src/Header/` and `src/Footer/` entirely, including the two revalidate hooks and row labels.
- The hand-written seed documents (`home.ts`, `home-static.ts`, `contact-page.ts`, `contact-form.ts`, `image-*.ts`, `post-*.ts`) under `src/endpoints/seed/`.
- `RichText`'s converter for the call-to-action block, which no field can hold.

Stays:

- `src/blocks/Banner`, `Code`, `MediaBlock` (config and component: the post body's `BlocksFeature` registers all three) and `RelatedPosts`: used by the post body's rich text and the post page.
- `src/heros/PostHero`: posts are not sections.
- `src/components/CollectionArchive` and `Card`: the posts index and the search page render through them; the `List` primitive replaces only the archive block.
- The form field components (`Checkbox`, `Country`, `Email`, `Message`, `Number`, `Select`, `State`, `Text`, `Textarea`, `Width`, `Error`): they live under `src/engine/primitives/form/`, where the `Form` primitive imports them.
- `src/fields/linkGroup.ts`: unused by the generated blocks, kept as part of the stock field library.
- Everything under `src/components/ui`, `Media`, `RichText`, `Link`, providers (the theme providers take `colorMode`), utilities.

## 8. Admin experience

- Blocks appear in the add-block drawer under their section's `group` (Heroes, Content, Social proof, Conversion, Blog; `Sections` for a section without one), with their `label`, `description` and preview image.
- Array rows show `rowLabel`'s value as the row title.
- Required fields and help text come from the section file.
- The seed button on the dashboard reads "Seed your database with Studio" and seeds the whole demo site.
