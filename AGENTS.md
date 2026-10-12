# AGENTS.md

Instructions for AI coding agents working in this repository. `CLAUDE.md` includes this file.

## What this project is

A config-driven sections engine built on the Payload website template. The site's theme, header, footer and sections are described in YAML under `templates/`; a compiler turns them into Payload block and global configs, and a generic renderer draws them. Adding or redesigning a section edits config files and no `.ts` or `.tsx` files.

Read first, in this order:

1. [docs/ASSIGNMENT.md](docs/ASSIGNMENT.md): the brief and what needs to be done.
2. [docs/spec/README.md](docs/spec/README.md): the specification. It indexes the format, compiler, renderer, Payload integration, demo site, build plan and decisions.
3. [llms.txt](llms.txt): the index of the official Payload 4.x documentation, the line the pinned version belongs to. Fetch the linked page before guessing at a Payload API.

## Stack

- Payload `4.0.0-beta.0` (admin, Local API, Lexical rich text) inside Next.js 16 App Router, React 19, TypeScript. The pre-release is deliberate: the template snapshot was written against it and 3.x lacks `@payloadcms/transformer-sharp`.
- MongoDB through `@payloadcms/db-mongodb`.
- Tailwind CSS 4 with shadcn-style components in `src/components/ui`.
- pnpm; Node version in `.nvmrc`.
- Tests: Vitest (`tests/int`) and Playwright (`tests/e2e`).

## Commands

| Task | Command |
| --- | --- |
| Install | `pnpm install` |
| Dev server | `pnpm dev` (http://localhost:3000, admin at `/admin`) |
| Type generation | `pnpm generate:types` after any collection, global, block or field change |
| Import map | `pnpm generate:importmap` after adding an admin component |
| Lint | `pnpm lint` |
| Build | `pnpm build` |
| Compile templates | `pnpm sections:compile` (`--watch` while editing); `pnpm sections:check` before committing |
| Integration tests | `pnpm test:int` |
| End-to-end tests | `pnpm test:e2e` |

Environment variables the code reads: `DATABASE_URL`, `PAYLOAD_SECRET`, `PREVIEW_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_SERVER_URL`. Copy `.env.example` to `.env`; never read or print `.env`.

## Where things live

| Path | Contents |
| --- | --- |
| `src/payload.config.ts` | The Payload config: collections, globals, plugins, db, editor |
| `src/collections/` | Pages, Posts, Media, Categories, Users |
| `src/blocks/`, `src/heros/` | The post body's blocks (`Banner`, `Code`, `MediaBlock`), `RelatedPosts` and `PostHero`; page sections come from the engine |
| `src/components/` | Shared React: `Media`, `RichText`, `Link` (CMSLink), `ui/` |
| `src/app/(frontend)/` | Public site routes |
| `src/app/(payload)/` | Admin and API routes, generated `importMap.js` |
| `src/endpoints/seed/` | The seed endpoint; it clears the collections and calls the engine's seeder |
| `templates/` | The site: `theme.yaml`, `globals/`, `sections/`, `seed/`, config and assets only, plus the generated `schema.json` |
| `src/engine/` | The hand-written engine: schemas, compiler, primitives, renderer, Payload helpers, seeder |
| `src/generated/sections/` | Compiler output (gitignored; never edit) |
| `docs/` | Assignment and spec |

## Conventions

- TypeScript throughout. No `any`, `@ts-ignore` or lint suppressions without a comment saying why.
- Server components by default; add `'use client'` only where state or browser APIs are needed.
- Payload config changes are followed by `pnpm generate:types`, and `src/payload-types.ts` is committed with them.
- Prefer the Local API (`getPayload`) in server code over fetching the REST API.
- Reuse `Media`, `RichText` and `CMSLink` instead of writing new media, rich text or link rendering.
- Keep output lean: a generated block has only the fields its section declares, and rendered markup is only what the layout tree asks for.
- Record design decisions and trade-offs in `docs/spec/decisions.md`, not in commit messages alone.
- Never add a `.ts` or `.tsx` file under `templates/`. A section is config; if it needs code, the engine needs a primitive or an option.

## Git

- Work on a branch; `main` is the integration branch and is pushed by the repository owner.
- Commit messages: short imperative subject, body explains why. Stage named files, not `-A`.
- No AI attribution on commits, pull requests, issues or comments: no `Co-Authored-By` naming an AI, no "generated with" notes, no session links.
- Never commit secrets, `.env` files or database dumps.
- Never run destructive git (`reset --hard`, `push --force`, `clean -f`) without an explicit instruction.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
