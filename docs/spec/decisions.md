# Decisions

Part of the [Sections Engine Specification](README.md). Every decision that shaped the design, with the options it was chosen over and what it commits the project to. Numbered so other documents can cite them.

## D1. YAML, validated by zod, with an exported JSON Schema

- **Options:** (a) JSON; (b) a TypeScript DSL (`defineSection({...})`); (c) YAML with a schema.
- **Decision:** (c). JSON is accepted by the same loader since it is valid YAML.
- **Why not (a):** no comments, noisy quoting, worse to hand-edit; the brief's own example is YAML.
- **Why not (b):** a `.ts` file per section is a component by another name: it needs the toolchain to validate, it invites imports and logic, and it fails the acceptance test (no `.ts` under `templates/`).
- **Consequence:** validation has to be excellent, because YAML will not catch anything itself. Positioned errors with hints and the schema file for editors are requirements, not polish.

## D2. The engine ships a whole site: theme, chrome and a library of sections

- **Options:** (a) the engine generates sections only (the brief's literal reading); (b) the engine generates a whole site: theme, header, footer and a library of sections.
- **Decision:** (b).
- **Why not (a):** it proves a section can be generated, not that a site can be. The question worth answering for an agency is whether a site comes from config, and that needs theme and chrome to be config too.
- **Consequence:** a complete demo site has to be built, which is more work than a handful of sections. The plan still delivers the single-section proof first.

## D3. `templates/` is config and assets only

- **Options:** (a) one file for the whole site; (b) a folder with `config/` plus an `index.ts` that assembles components; (c) a folder of config and assets, nothing executable.
- **Decision:** (c).
- **Why not (a):** a site is a dozen or more sections, a theme and two globals; one file is unreadable.
- **Why not (b):** an `index.ts` holding components is a component. It was considered and rejected on the acceptance test. If an index is ever useful, the compiler generates it.
- **Consequence:** everything the site can express has to be expressible in YAML, so the primitive vocabulary and options are the engine's whole surface.

## D4. A compile step plus a runtime interpreter, not generated components

- **Options:** (a) generate a `.tsx` component per section; (b) interpret the YAML at runtime with no compile step; (c) compile to data (configs and a plan) and interpret the plan at runtime.
- **Decision:** (c).
- **Why not (a):** generated components are hard to read when they break, are tempting to edit, and still need the block config generated separately. The engine would be a code generator with two outputs to keep in sync.
- **Why not (b):** Payload needs its block configs at config-load time, `next/font` needs literal imports, and Tailwind needs class strings in files it scans. All three force a build-time step anyway.
- **Consequence:** the renderer is a small interpreter over a typed plan, which is easy to test exhaustively; the compiler owns all validation so the renderer can trust its input.

## D5. Generated output lives at one stable, ignored path

- **Options:** (a) commit generated files; (b) `src/generated/sections/`, gitignored.
- **Decision:** (b), rebuilt by `predev` and `prebuild`.
- **Why not (a):** generated diffs drown reviews and drift from their source.
- **Consequence:** every import of generated code is hand-written once against a path that never moves. `src/payload-types.ts` stays committed, as Payload expects, and changes in review whenever a section's fields change.

## D6. Bare names are references; `{ value }` is a literal

- **Options:** (a) a sigil for references (`$heading`); (b) bare names for references, an explicit wrapper for literals.
- **Decision:** (b).
- **Why not (a):** nearly every value in a layout is a reference, so the sigil would be on almost every line; and the compiler already knows every field in scope, so an unknown bare name is caught with a suggestion.
- **Consequence:** inside `list`, row fields come from a collection the section did not declare. The compiler carries a field list per allowed collection so those references are checked too.

## D7. Variants live in the theme and are resolved at compile time

- **Options:** (a) per-section variant maps; (b) theme-level named presets only; (c) a runtime class resolver.
- **Decision:** (b), merged into `className` by the compiler.
- **Why not (a):** presets exist to keep the site consistent; per-section maps fragment them.
- **Why not (c):** it puts theme knowledge in the renderer and work on every request for a value that never changes between builds.
- **Consequence:** the plan contains final class strings and the renderer is theme-agnostic.

## D8. Icons are a curated select, not an upload

- **Options:** (a) upload field; (b) free text matched against lucide at render; (c) a `select` over a curated lucide list.
- **Decision:** (c).
- **Why not (a):** editors would have to source SVGs; previews and consistency suffer.
- **Why not (b):** typos fail at render time and the whole icon set would be imported.
- **Consequence:** adding an icon is an engine change (one line in `icons.ts`), which is acceptable because the set is shared by every section and is a vocabulary, not a design.

## D9. The hero is a section; the Hero tab goes

- **Options:** (a) keep the Hero tab restricted to sections flagged as heroes; (b) remove it.
- **Decision:** (b).
- **Why not (a):** a hero is a block with a position, and position is what `layout` already expresses. A separate tab is a second mechanism for the same thing and complicates the renderer.
- **Consequence:** the post page keeps its own `PostHero`; posts are not sections.

## D10. No `slot` primitive

- **Options:** (a) globals wrap the page through a `slot: page` node; (b) the frontend layout renders the header global, the page, then the footer global.
- **Decision:** (b).
- **Why not (a):** it makes a global a layout rather than a region, adds a primitive with exactly one legal use, and couples the renderer to the Next.js layout tree.
- **Consequence:** the page body always sits between header and footer. No demo page needs otherwise.

## D11. Block slugs are the section name; interfaces are PascalCase plus Block

- **Options:** (a) the section name as the slug; (b) a prefixed slug.
- **Decision:** (a). `hero-split` is the slug and `HeroSplitBlock` the interface; the header and footer globals keep the stock slugs `header` and `footer`, with interfaces `Header` and `Footer`.
- **Why not (b):** a prefix only pays for itself when two sets of sections share one database, and here the section names are unique by rule. A bare slug reads the same in the YAML, the database, the types and the admin.
- **Consequence:** `getCachedGlobal`, its cache tags and the admin's global navigation work unchanged, and a `blockType` in a page document is the file name of the section that renders it.

## D12. Hand-written page blocks and heroes are removed in the last phase, not the first

- **Options:** (a) delete them at the start; (b) keep them as reference forever; (c) keep them until the section library covers the demo pages, then remove.
- **Decision:** (c).
- **Why not (a):** the repository would not render anything until the renderer and the first sections exist, and the stock blocks are useful precedent while the primitives are written.
- **Why not (b):** two ways to build a page defeat the point, and dead code fails the lean-output principle.
- **Consequence:** `Banner`, `Code`, `MediaBlock`'s component and `RelatedPosts` stay because the post body uses them; posts are out of scope.

## D13. Seeds are YAML read by one generic seeder

- **Options:** (a) a hand-written seed module; (b) YAML seed files beside the sections and one seeder.
- **Decision:** (b).
- **Why not (a):** a seed module is `.ts` describing content the section files already describe, which fails the acceptance test and duplicates their field knowledge.
- **Consequence:** the seeder validates seed data against section fields and resolves `@media`, `@page`, `@form` and `@category` tokens; rich text is authored as Markdown and converted.

## D14. Fonts are Google Fonts names compiled into `next/font` loaders

- **Options:** (a) a `<link>` to Google Fonts CSS at runtime; (b) generated `next/font/google` loaders; (c) local font files.
- **Decision:** (b); (c) is the planned extension.
- **Why not (a):** render-blocking external CSS, no self-hosting, no font-display control.
- **Consequence:** builds need network access to fetch fonts, and the theme's font names must be exact family names.

## D15. Field names are camelCase identifiers

- **Options:** (a) accept any string and sanitise; (b) accept kebab-case and convert; (c) require identifiers and reject the rest with the fix.
- **Decision:** (c).
- **Why not (a) or (b):** a silent conversion means the name an author wrote is not the name in the data, the types or the API, which is a debugging trap. Payload, TypeScript and GraphQL all want identifiers.
- **Consequence:** the brief's `bullet-icon` is rejected with `use "bulletIcon"`.

## D16. Server components everywhere except the form

- **Options:** (a) a client-side renderer; (b) server components with one client primitive.
- **Decision:** (b).
- **Why not (a):** the plan and the data are both available on the server, and shipping an interpreter to the browser for static marketing pages is weight for nothing.
- **Consequence:** interactive sections need a new primitive with its own client boundary, or a native element such as `details`; the mobile menu is the first such case and is deferred.

## D17. `list` queries select only what the layout references

- **Options:** (a) fetch whole documents at depth 1; (b) derive `select` from the children's references.
- **Decision:** (b).
- **Why not (a):** the brief asks for lean output, and a post document with its full Lexical body is large.
- **Consequence:** the compiler knows each allowed collection's fields and the renderer passes `select` through unchanged.

## D18. The spec is a set of documents, each owning one concern

- **Options:** (a) one long file; (b) an index with one document per concern.
- **Decision:** (b).
- **Why not (a):** the format, the compiler and the renderer are read by different people at different times, and a single file would be several hundred lines of context-switching.
- **Consequence:** cross-references are plain relative links, and [README.md](README.md) is the only entry point.
