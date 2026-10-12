# Decisions

Part of the [Sections Engine Specification](README.md). Every decision that shaped the design, with the options it was chosen over and what it commits the project to. Numbered so other documents can cite them.

## D1. YAML, validated by zod, with an exported JSON Schema

- **Options:** (a) JSON; (b) a TypeScript DSL (`defineSection({...})`); (c) YAML with a schema.
- **Decision:** (c). JSON is accepted by the same loader since it is valid YAML.
- **Why not (a):** no comments, noisy quoting, worse to hand-edit; the brief's own example is YAML.
- **Why not (b):** a `.ts` file per section is a component by another name: it needs the toolchain to validate, it invites imports and logic, and it fails the acceptance test (no `.ts` under `templates/`).
- **Consequence:** validation has to be excellent, because YAML will not catch anything itself. Positioned errors with hints and the schema file for editors are requirements, not polish.

## D2. A template is a whole site face

- **Options:** (a) a template is one section (the brief's literal reading); (b) a template is a face: theme, header, footer, sections.
- **Decision:** (b). Sections live inside a template.
- **Why not (a):** it proves a section can be generated, not that a site can be. The question worth answering for an agency is whether many sites come from one engine, and that needs theme and chrome to be config too.
- **Consequence:** two complete faces have to be built, which is more work than two sections. Phase 2 of the plan still delivers the single-section proof first.

## D3. Folder per template, config and assets only

- **Options:** (a) one file per template; (b) a folder with `config/` plus an `index.ts` that assembles components; (c) a folder of config and assets, nothing executable.
- **Decision:** (c).
- **Why not (a):** a face is a dozen sections, a theme and two globals; one file is unreadable.
- **Why not (b):** an `index.ts` holding components is a component. It was considered and rejected on the acceptance test. If an index is ever useful, the compiler generates it.
- **Consequence:** everything a template can express has to be expressible in YAML, so the primitive vocabulary and options are the engine's whole surface.

## D4. A compile step plus a runtime interpreter, not generated components

- **Options:** (a) generate a `.tsx` component per section from the template; (b) interpret the template at runtime with no compile step; (c) compile to data (configs and a plan) and interpret the plan at runtime.
- **Decision:** (c).
- **Why not (a):** generated components are hard to read when they break, are tempting to edit, and still need the block config generated separately. The engine would be a code generator with two outputs to keep in sync.
- **Why not (b):** Payload needs its block configs at config-load time, `next/font` needs literal imports, and Tailwind needs class strings in files it scans. All three force a build-time step anyway.
- **Consequence:** the renderer is a small interpreter over a typed plan, which is easy to test exhaustively; the compiler owns all validation so the renderer can trust its input.

## D5. Generated output lives at one stable, ignored path

- **Options:** (a) commit generated files; (b) `src/generated/<template>/` per template; (c) `src/generated/sections/` for the active template, gitignored.
- **Decision:** (c), rebuilt by `predev` and `prebuild`.
- **Why not (a):** generated diffs drown reviews and drift from their source.
- **Why not (b):** every import site would need the template name, which means a switch touches code or an indirection module that is itself generated.
- **Consequence:** `src/payload-types.ts` (committed, as Payload expects) changes when the active template changes. Accepted and documented.

## D6. Bare names are references; `{ value }` is a literal

- **Options:** (a) a sigil for references (`$heading`); (b) bare names for references, an explicit wrapper for literals.
- **Decision:** (b).
- **Why not (a):** nearly every value in a layout is a reference, so the sigil would be on almost every line; and the compiler already knows every field in scope, so an unknown bare name is caught with a suggestion.
- **Consequence:** inside `list`, row fields come from a collection the template did not declare. The compiler carries a field list per allowed collection so those references are checked too.

## D7. Variants live in the theme and are resolved at compile time

- **Options:** (a) per-section variant maps; (b) theme-level named presets only; (c) a runtime class resolver.
- **Decision:** (b), merged into `className` by the compiler.
- **Why not (a):** presets exist to make faces consistent; per-section maps fragment them.
- **Why not (c):** it puts theme knowledge in the renderer and work on every request for a value that never changes between builds.
- **Consequence:** the plan contains final class strings and the renderer is theme-agnostic.

## D8. Icons are a curated select, not an upload

- **Options:** (a) upload field; (b) free text matched against lucide at render; (c) a `select` over a curated lucide list.
- **Decision:** (c).
- **Why not (a):** editors would have to source SVGs; previews and consistency suffer.
- **Why not (b):** typos fail at render time and the whole icon set would be imported.
- **Consequence:** adding an icon is an engine change (one line in `icons.ts`), which is acceptable because the set is shared by every template and is a vocabulary, not a design.

## D9. The hero is a section; the Hero tab goes

- **Options:** (a) keep the Hero tab restricted to sections flagged as heroes; (b) remove it.
- **Decision:** (b).
- **Why not (a):** a hero is a block with a position, and position is what `layout` already expresses. A separate tab is a second mechanism for the same thing and complicates the renderer.
- **Consequence:** the post page keeps its own `PostHero`; posts are not sections.

## D10. No `slot` primitive

- **Options:** (a) globals wrap the page through a `slot: page` node; (b) the frontend layout renders the header global, the page, then the footer global.
- **Decision:** (b).
- **Why not (a):** it makes a global a layout rather than a region, adds a primitive with exactly one legal use, and couples the renderer to the Next.js layout tree.
- **Consequence:** a template cannot put the page body anywhere but between header and footer. No demo needs otherwise.

## D11. Block slugs are `<template>-<section>`; interfaces are PascalCase

- **Options:** (a) bare section names; (b) prefixed slugs.
- **Decision:** (b).
- **Why not (a):** two templates with a `hero` would collide in the database and in the types; a page authored under one template would be misread by the other.
- **Consequence:** `blockType` values are longer. Editors never see them.

## D12. Global slugs stay `header` and `footer`

- **Options:** (a) prefix globals like blocks; (b) keep the stock slugs and vary the fields per template.
- **Decision:** (b).
- **Why not (a):** `getCachedGlobal`, its cache tags and the admin's global navigation all key on the slug; prefixing buys nothing because only one template is active at a time.
- **Consequence:** switching templates changes the shape of the header and footer documents; the seeder rewrites both.

## D13. `SITE_TEMPLATE` selects the face at build time; switching is rebuild plus reseed

- **Options:** (a) per-request switching with every page carrying its template; (b) one active template per build.
- **Decision:** (b).
- **Why not (a):** it needs every page to know its template, both templates' blocks mounted at once, and the renderer choosing a plan set per request. It is a multi-site feature and the brief is a sections engine.
- **Consequence:** one database, one face at a time. Documented in the integration notes with what happens to existing content.

## D14. Hand-written page blocks and heroes are removed in the last phase, not the first

- **Options:** (a) delete them at the start; (b) keep them as reference forever; (c) keep them until both faces cover a demo page, then remove.
- **Decision:** (c).
- **Why not (a):** the repository would not render anything until phase 3, and the stock blocks are useful precedent while the primitives are written.
- **Why not (b):** two ways to build a page defeat the point, and dead code fails the lean-output principle.
- **Consequence:** `Banner`, `Code`, `MediaBlock`'s component and `RelatedPosts` stay because the post body uses them; posts are out of scope.

## D15. Seeds are YAML read by one generic seeder

- **Options:** (a) a hand-written seed module per template; (b) YAML seed files per template and one seeder.
- **Decision:** (b).
- **Why not (a):** a seed module is `.ts` under a template's ownership, which fails the acceptance test, and it duplicates the field knowledge the section file already has.
- **Consequence:** the seeder validates seed data against section fields and resolves `@media`, `@page` and `@form` tokens; rich text is authored as Markdown and converted.

## D16. Fonts are Google Fonts names compiled into `next/font` loaders

- **Options:** (a) a `<link>` to Google Fonts CSS at runtime; (b) generated `next/font/google` loaders; (c) local font files.
- **Decision:** (b); (c) is the planned extension.
- **Why not (a):** render-blocking external CSS, no self-hosting, no font-display control.
- **Consequence:** builds need network access to fetch fonts, and the theme's font names must be exact family names.

## D17. Field names are camelCase identifiers

- **Options:** (a) accept any string and sanitise; (b) accept kebab-case and convert; (c) require identifiers and reject the rest with the fix.
- **Decision:** (c).
- **Why not (a) or (b):** a silent conversion means the name an author wrote is not the name in the data, the types or the API, which is a debugging trap. Payload, TypeScript and GraphQL all want identifiers.
- **Consequence:** the brief's `bullet-icon` is rejected with `use "bulletIcon"`.

## D18. Server components everywhere except the form

- **Options:** (a) a client-side renderer; (b) server components with one client primitive.
- **Decision:** (b).
- **Why not (a):** the plan and the data are both available on the server, and shipping an interpreter to the browser for static marketing pages is weight for nothing.
- **Consequence:** interactive sections need a new primitive with its own client boundary; the mobile menu is the first such case and is deferred.

## D19. `list` queries select only what the layout references

- **Options:** (a) fetch whole documents at depth 1; (b) derive `select` from the children's references.
- **Decision:** (b).
- **Why not (a):** the brief asks for lean output, and a post document with its full Lexical body is large.
- **Consequence:** the compiler knows each allowed collection's fields and the renderer passes `select` through unchanged.

## D20. The spec is a set of documents, each owning one concern

- **Options:** (a) one long file; (b) an index with one document per concern.
- **Decision:** (b).
- **Why not (a):** the format, the compiler and the renderer are read by different people at different times, and a single file would be several hundred lines of context-switching.
- **Consequence:** cross-references are plain relative links, and [README.md](README.md) is the only entry point.
