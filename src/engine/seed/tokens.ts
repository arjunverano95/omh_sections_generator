/**
 * Reference tokens in seed files: `@media/<file>`, `@page/<slug>`, `@form/<key>` and
 * `@category/<slug>`. Anything else that starts with `@` is an error, so a typo never
 * reaches the database as a literal string.
 */

export const TOKEN_KINDS = ['media', 'page', 'form', 'category'] as const
export type TokenKind = (typeof TOKEN_KINDS)[number]
export type Token = { kind: TokenKind; key: string }

const TOKEN = /^@([a-z]+)\/(.+)$/

/** Parses a token, or returns null for a value that is not one. Throws on a malformed token. */
export function parseToken(value: unknown): Token | null {
  if (typeof value !== 'string' || !value.startsWith('@')) return null
  const match = value.match(TOKEN)
  if (!match || !(TOKEN_KINDS as readonly string[]).includes(match[1]!)) {
    throw new Error(
      `"${value}" is not a reference token; expected one of ${TOKEN_KINDS.map((k) => `@${k}/<...>`).join(', ')}`,
    )
  }
  return { kind: match[1] as TokenKind, key: match[2]! }
}

/** A category's slug from its title, the same rule the seeder uses when creating it. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
