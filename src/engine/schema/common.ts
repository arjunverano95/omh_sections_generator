/**
 * Names, patterns and vocabularies shared by the schemas and the compiler.
 */

/** Field names become Payload field names, TypeScript properties and GraphQL names. */
export const FIELD_NAME_RE = /^[a-z][a-zA-Z0-9]*$/
/** Section names are block slugs. */
export const SECTION_NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
/** A CSS length for `radius`: a number with a unit, or a bare `0`. */
export const CSS_LENGTH_RE = /^(0|-?(\d+|\d*\.\d+)(px|rem|em|%|vh|vw|vmin|vmax|ch|ex|cap|ic|lh|rlh))$/

export const RESERVED_FIELD_NAMES = ['id', 'blockType', 'blockName', 'createdAt', 'updatedAt'] as const

export const GLOBAL_NAMES = ['header', 'footer'] as const

export const RELATION_COLLECTIONS = ['pages', 'posts', 'categories'] as const

/** The colour slots the stock stylesheet defines; a theme may set any of them. */
export const COLOR_SLOTS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
  'success',
  'warning',
  'error',
] as const
export type ColorSlot = (typeof COLOR_SLOTS)[number]

/** The slots `colors.light` must set. */
export const REQUIRED_LIGHT_SLOTS = ['background', 'foreground', 'primary', 'primary-foreground'] as const

/** `bullet-icon` to `bulletIcon`, the fix the compiler suggests for a hyphenated name. */
export function toCamelCase(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part, i) => (i === 0 ? part : part[0]!.toUpperCase() + part.slice(1)))
    .join('')
}

/** `primaryButton` to `Primary button`, the default admin label. */
export function toLabel(name: string): string {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** `hero-split` to `HeroSplit`. */
export function toPascalCase(name: string): string {
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('')
}

/** `Playfair Display` to `playfair-display`. */
export function toKebabCase(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}
