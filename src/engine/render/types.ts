/**
 * The render plan: what the compiler emits for every block and global, and what the
 * renderer interprets. Nothing here knows about any particular section or site.
 *
 * Contract between src/engine/compiler (producer) and src/engine/render (consumer).
 * Everything the renderer would otherwise have to check — variant names, tag names,
 * reference validity, list selects — is resolved by the compiler before a plan exists.
 */

export const TEXT_TAGS = [
  'p',
  'span',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'small',
  'strong',
  'em',
  'li',
  'dt',
  'dd',
  'figcaption',
  'summary',
] as const
export type TextTag = (typeof TEXT_TAGS)[number]

export const CONTAINER_TAGS = [
  'div',
  'section',
  'header',
  'footer',
  'nav',
  'main',
  'article',
  'aside',
  'ul',
  'ol',
  'li',
  'figure',
  'figcaption',
  'blockquote',
  'details',
] as const
export type ContainerTag = (typeof CONTAINER_TAGS)[number]

export const LIST_COLLECTIONS = ['posts', 'pages', 'categories'] as const
export type ListCollection = (typeof LIST_COLLECTIONS)[number]

/**
 * A reference into the scope chain: `['meta', 'image']` for `meta.image`. `depth` is the
 * index into the scope chain (0 = innermost) that declares `path[0]`; the compiler always
 * emits it, so the renderer never guesses when a row omits an unset field. Without `depth`
 * (hand-written plans) the renderer searches outward for the first scope holding the key.
 */
export type Ref = { path: string[]; depth?: number }
/** Fixed text that is not editable. */
export type Literal = { value: string }
export type Source = Ref | Literal

/** `if:` — a bare reference tests truthiness; exactly one of `equals` / `not` otherwise. */
export type Condition = { path: string[]; depth?: number; equals?: unknown; not?: unknown }

/**
 * The literal-button form: destination from the data or a fixed URL. `label` is the anchor
 * text; the compiler requires it unless the node has `children`.
 */
export type ButtonLiteral = { label?: string; href: Source; newTab?: boolean }

/** A `{ field: name }` placeholder inside a `where` clause, filled from the scope at render time. */
export type WherePlaceholder = { field: string }

export type ListQuery = {
  collection: ListCollection
  limit: number
  sort?: string
  /** Payload `where` syntax, with WherePlaceholder objects left in place for the renderer. */
  where?: Record<string, unknown>
  /** Payload `select`, derived from the children's references plus `slug`. */
  select: Record<string, unknown>
}

type Common = { className?: string; if?: Condition }

/**
 * `labels` is present only when the source is a `select` whose options carry labels that
 * differ from their values; the renderer prints the label for the stored value.
 */
export type TextNode = Common & { type: 'text'; source: Source; as: TextTag; labels?: Record<string, string> }
export type RichTextNode = Common & { type: 'richText'; source: Ref }
export type ImageNode = Common & { type: 'image'; source: Ref; priority?: boolean; sizes?: string }
export type IconNode = Common & { type: 'icon'; source: Ref; size?: number }
/**
 * With `children`, the anchor wraps them (a logo image, a styled wordmark) instead of a
 * label; a `link` reference's label then becomes the anchor's accessible name.
 */
export type ButtonNode = Common & { type: 'button'; source: Ref | ButtonLiteral; children?: PlanNode[] }
export type ContainerNode = Common & { type: 'div'; as: ContainerTag; children: PlanNode[] }
export type EachNode = Common & { type: 'each'; source: Ref; as?: ContainerTag; children: PlanNode[] }
export type ListNode = { type: 'list'; query: ListQuery; as?: ContainerTag; className?: string; children: PlanNode[] }
export type FormNode = Common & { type: 'form'; source: Ref }

export type PlanNode =
  | TextNode
  | RichTextNode
  | ImageNode
  | IconNode
  | ButtonNode
  | ContainerNode
  | EachNode
  | ListNode
  | FormNode

export const PLAN_NODE_TYPES = [
  'text',
  'richText',
  'image',
  'icon',
  'button',
  'div',
  'each',
  'list',
  'form',
] as const
export type PlanNodeType = (typeof PLAN_NODE_TYPES)[number]

/** One block's or global's layout, fully resolved. */
export type Plan = PlanNode[]
/** Keyed by block slug (`hero-split`) or global slug (`header`, `footer`). */
export type Plans = Record<string, Plan>

/** Data the renderer resolves references against. Innermost scope first: `[row, section]`. */
export type ScopeObject = Record<string, unknown>
export type Scope = ScopeObject[]

export function isRef(source: Source | ButtonLiteral): source is Ref {
  return typeof source === 'object' && source !== null && 'path' in source
}

export function isLiteral(source: Source | ButtonLiteral): source is Literal {
  return typeof source === 'object' && source !== null && 'value' in source && !('href' in source)
}

export function isButtonLiteral(source: Ref | ButtonLiteral): source is ButtonLiteral {
  return typeof source === 'object' && source !== null && 'href' in source
}

export function isWherePlaceholder(value: unknown): value is WherePlaceholder {
  return (
    typeof value === 'object' &&
    value !== null &&
    'field' in value &&
    Object.keys(value).length === 1 &&
    typeof (value as WherePlaceholder).field === 'string'
  )
}
