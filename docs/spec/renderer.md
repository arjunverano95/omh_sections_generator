# Renderer

Part of the [Sections Engine Specification](README.md). The renderer takes a block's data and the plan the compiler produced for its slug ([compiler.md section 4](compiler.md#4-generated-files)) and returns React elements. It has no knowledge of any particular section.

## 1. Entry points

```
src/engine/render/
  RenderSections.tsx   ({ blocks }) -> renders a page's layout array
  RenderGlobal.tsx     ({ slug }) -> fetches the global, renders its plan
  RenderTree.tsx       ({ nodes, scope }) -> the recursive walker
  scope.ts             resolve(ref, scope), truthy(value), test(condition, scope)
  registry.ts          node type -> primitive component
  types.ts             Plan, PlanNode, Scope
src/engine/primitives/
  Text.tsx  RichText.tsx  Image.tsx  Icon.tsx  Button.tsx  Container.tsx  Each.tsx  List.tsx  Form.tsx
```

`RenderSections` replaces `RenderBlocks` on pages: for each row of `layout` it looks up `plans[row.blockType]` and renders `RenderTree` with the row as the root scope. A `blockType` without a plan is a programming error (the config and the plan come from the same compile) and throws in development; in production it renders nothing and logs once.

`RenderGlobal` calls the existing `getCachedGlobal(slug, 1)` and renders `plans[slug]`. The frontend layout mounts it twice, for `header` and `footer`.

## 2. Scope and references

A scope is a chain of plain objects, innermost first: `[row, section]` inside an `each`, `[document, section]` inside a `list`, `[section]` at the top. A reference `{ path: ['meta', 'image'] }` is resolved by walking the chain from the innermost scope and following the path; the first scope that has the first segment wins. The compiler has already checked that the path exists somewhere in the chain, so a miss at runtime means the editor left the field empty.

**Empty means absent.** A node whose source resolves to `undefined`, `null`, `''`, `[]` or an unpopulated relation renders nothing, including its own element. This is what keeps optional fields from leaving empty tags behind.

Conditions (`if`) are tested against the same chain: `truthy` for a bare reference, strict equality for `equals`, strict inequality for `not`.

## 3. Primitives

Every primitive is a server component except `Form`. Each receives the node, the resolved value and the scope, and emits only the markup described here.

| Primitive | Emits | Reuses |
| --- | --- | --- |
| `Text` | `<{as} className>{string}</{as}>`. Numbers are formatted with `toLocaleString`. Select values render their label when the field has one. | |
| `RichText` | the project's `RichText` with `enableGutter={false}`, `enableProse` on, wrapped in nothing. `className` is passed through. | `src/components/RichText` |
| `Image` | the project's `Media` with `resource`, `imgClassName={className}`, `priority`, `sizes`. Alt text comes from the media document. | `src/components/Media` |
| `Icon` | the matching `lucide-react` component from the engine's curated map, `aria-hidden`, `size` default 20. | `lucide-react` |
| `Button` | the project's `CMSLink` with `appearance="inline"` and `className`, so the theme's variant classes style it and no shadcn button variant leaks in. The literal form passes `url` and `label` directly. | `src/components/Link` |
| `Container` | `<{as} className>{children}</{as}>` | |
| `Each` | for each row: `RenderTree(children, [row, ...scope])`; rows are wrapped in `{as}` when `as` is set, each row keyed by its `id`. | |
| `List` | section 4 | |
| `Form` | section 5 | `src/engine/primitives/form` |

The registry maps `node.type` to a primitive and is the one place a new primitive is registered. A node type missing from the registry is unreachable (the compiler validates against the same list) and throws in development.

## 4. `List`

An async server component.

1. Fill `where` placeholders from the scope (`{ field: category }` becomes the section's `category` value; a placeholder that resolves to empty removes that clause).
2. `payload.find({ collection, limit, sort, where, select, depth: 1, draft: false, overrideAccess: false })` through `getPayload({ config })`.
3. Render children once per document with `[doc, ...scope]`, after adding the synthetic `url`.

No documents means no output, consistent with section 2. The query is not cached beyond Next.js's request memoisation; the pages that use it are already revalidated by the existing page hooks, and a post publish does not revalidate pages that list posts. That gap is accepted for the demo and recorded in [build-plan.md](build-plan.md).

## 5. `Form`

The one client boundary. `Form` is the stock `FormBlock` component with its field components, kept under `src/engine/primitives/form/`, without the block-specific props (`enableIntro`, `introContent`) and with `className`. It keeps the stock behaviour: builds inputs from the form document's fields, posts to `/api/form-submissions`, shows the confirmation message or redirects. The form document arrives populated because the `form` field is a relationship and the page query runs at depth 2, as the stock template already does.

## 6. Theme application

The renderer never reads the theme. Variants were merged into `className` at compile time, and tokens apply through CSS:

- `src/app/(frontend)/layout.tsx` imports `@/generated/sections/theme.css` after `./globals.css`, and adds `fontVariables` from `@/generated/sections/fonts` to the `<html>` class list in place of the Geist Sans variable (Geist Mono stays).
- `globals.css` declares the slot `--font-heading: var(--font-sans)` inside `@theme` so the `font-heading` utility always exists; `theme.css` sets its value.

The palette comes from the theme's `colorMode`, which the frontend's theme script reads from the generated manifest: `light` and `dark` set that palette for every visitor, `system` follows the device setting. Dark styling works through the existing `[data-theme='dark']` variant; `theme.css` overrides the tokens under the same selector. There is no visitor switch.

## 7. Server and client

- `RenderSections`, `RenderGlobal`, `RenderTree` and every primitive but `Form` are server components, so the layout tree adds no client JavaScript.
- `Button` renders `CMSLink`, which is a server component in the stock template.
- Live preview needs no change: the existing `LivePreviewListener` refreshes the server-rendered page and the renderer is a pure function of the data it is given.
- Native disclosures need no client code: a `div` with `as: details` holding a `text` with `as: summary` opens and closes in the browser, as the FAQ section's items do.
- The Studio header has no mobile menu; it hides the nav below `md` and relies on the footer links. A menu built from the same `details` and `summary` tags is the config-only follow-up, listed as an open issue.

## 8. Accessibility defaults

- Headings come from `as`; a page is expected to carry one `h1`, which every seeded page does (each opens with a hero).
- `Image` carries the media document's `alt`. An image without alt text is an editor error the media collection already enforces.
- `Icon` is decorative (`aria-hidden`); meaningful icons sit next to text in the demo site.
- `Each` with `as: ul` renders rows as the section's `li` nodes; the compiler warns when a `ul` has non-`li` children ([template-format.md section 9](template-format.md#9-validation-rules)).
- `Button` renders a real anchor through `CMSLink`; `newTab` adds `rel="noopener noreferrer"`.

## 9. Tests

`tests/int/engine/renderer.int.spec.ts`, under the existing Vitest jsdom setup with `@testing-library/react`:

- Each primitive against a hand-written plan node and data: emitted tag, classes, text; empty value renders nothing.
- Scope chain: a row reference shadows a section reference; an outer reference is reachable from a row.
- Conditions: truthy, `equals`, `not`, and that a failed condition emits no wrapper.
- `Each` with and without `as`; keys by row id.
- `List` with `getPayload` mocked: `where` placeholders filled, empty placeholders dropped, `select` passed through unchanged, synthetic `url` per collection.
- A full plan from a compiled fixture rendered end to end against seed data, as a snapshot of the HTML.
