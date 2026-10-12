import { z } from 'zod'

import {
  CONTAINER_TAGS,
  LIST_COLLECTIONS,
  PLAN_NODE_TYPES,
  TEXT_TAGS,
  type ListCollection,
  type PlanNodeType,
} from '../render/types'

export type LayoutLiteral = { value: string | number }
export type LayoutButtonLiteral = { label?: string; href: string | { value: string }; newTab?: boolean }
export type LayoutListQuery = {
  collection: ListCollection
  limit: number
  sort?: string
  where?: Record<string, unknown>
}
export type LayoutCondition = string | { field: string; equals?: unknown; not?: unknown }

/**
 * A layout node as written: one primitive key plus options. Which options a primitive takes,
 * and which `as` values, is enforced by `refineNode`, so a mistake is reported at the option.
 */
export type LayoutNode = {
  text?: string | LayoutLiteral
  richText?: string
  image?: string
  icon?: string
  button?: string | LayoutButtonLiteral
  div?: string
  each?: string
  list?: LayoutListQuery
  form?: string
  as?: string
  class?: string
  variant?: string
  if?: LayoutCondition
  children?: LayoutNode[]
  priority?: boolean
  sizes?: string
  size?: number
}

export const PRIMITIVE_KEYS = PLAN_NODE_TYPES
export type PrimitiveKey = PlanNodeType

/** Options each primitive accepts (template-format.md section 6.1). */
export const PRIMITIVE_OPTIONS: Record<PrimitiveKey, readonly string[]> = {
  text: ['as', 'class', 'variant', 'if'],
  richText: ['class', 'variant', 'if'],
  image: ['class', 'variant', 'priority', 'sizes', 'if'],
  icon: ['class', 'variant', 'size', 'if'],
  button: ['class', 'variant', 'children', 'if'],
  div: ['as', 'variant', 'children', 'if'],
  each: ['as', 'class', 'variant', 'children', 'if'],
  list: ['as', 'class', 'variant', 'children'],
  form: ['class', 'variant', 'if'],
}

export const CHILDREN_REQUIRED: readonly PrimitiveKey[] = ['div', 'each', 'list']

/** The primitive key of a node, or the list of primitive keys found when it is not exactly one. */
export function primitiveOf(node: Record<string, unknown>): PrimitiveKey | PrimitiveKey[] {
  const found = PRIMITIVE_KEYS.filter((key) => key in node && node[key] !== undefined)
  return found.length === 1 ? found[0]! : found
}

const VARIANT_REF_RE = /^[a-zA-Z][a-zA-Z0-9_-]*\.[a-zA-Z][a-zA-Z0-9_-]*$/

const ref = z.string().min(1, { error: 'a reference is a field name' })

function refineNode(node: LayoutNode, ctx: z.RefinementCtx): void {
  const primitive = primitiveOf(node as Record<string, unknown>)
  if (Array.isArray(primitive)) {
    ctx.addIssue({
      code: 'custom',
      message:
        primitive.length === 0
          ? `a layout node has exactly one primitive key (${PRIMITIVE_KEYS.join(', ')})`
          : `a layout node has exactly one primitive key; this one has ${primitive.map((p) => `"${p}"`).join(' and ')}`,
    })
    return
  }

  const allowed = PRIMITIVE_OPTIONS[primitive]
  for (const key of Object.keys(node)) {
    if (key === primitive) continue
    if ((node as Record<string, unknown>)[key] === undefined) continue
    if (!allowed.includes(key)) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `"${key}" is not an option of "${primitive}" nodes; the options are ${allowed.join(', ')}`,
      })
    }
  }

  if (node.as !== undefined && allowed.includes('as')) {
    const tags: readonly string[] = primitive === 'text' ? TEXT_TAGS : CONTAINER_TAGS
    if (!tags.includes(node.as)) {
      ctx.addIssue({
        code: 'custom',
        path: ['as'],
        message: `"${node.as}" is not an "as" value for "${primitive}" nodes; use one of ${tags.join(', ')}`,
      })
    }
  }

  if (CHILDREN_REQUIRED.includes(primitive)) {
    if (!node.children) {
      ctx.addIssue({ code: 'custom', path: ['children'], message: `"${primitive}" nodes need children` })
    } else if (node.children.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['children'],
        message: `"${primitive}" nodes need at least one child`,
      })
    }
  }

  if (primitive === 'button' && typeof node.button === 'object' && node.button !== null) {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0
    if (!hasChildren && !node.button.label) {
      ctx.addIssue({
        code: 'custom',
        path: ['button'],
        message: 'a literal button needs a label unless it has children',
      })
    }
  }

  const condition = node.if
  if (condition !== undefined && typeof condition === 'object' && condition !== null) {
    const has = (['equals', 'not'] as const).filter((k) => condition[k] !== undefined)
    if (has.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['if'],
        message: '"if" takes exactly one of equals or not beside field',
      })
    }
  }
}

export const LayoutNodeSchema: z.ZodType<LayoutNode> = z.lazy(() =>
  z
    .strictObject({
      text: z.union([ref, z.strictObject({ value: z.union([z.string(), z.number()]) })]).optional(),
      richText: ref.optional(),
      image: ref.optional(),
      icon: ref.optional(),
      button: z
        .union([
          ref,
          z.strictObject({
            label: z.string().min(1).optional(),
            href: z.union([ref, z.strictObject({ value: z.string().min(1) })]),
            newTab: z.boolean().optional(),
          }),
        ])
        .optional(),
      div: z.string().optional(),
      each: ref.optional(),
      list: z
        .strictObject({
          collection: z.enum(LIST_COLLECTIONS, {
            error: `list.collection is one of ${LIST_COLLECTIONS.join(', ')}`,
          }),
          limit: z.int().min(1).max(50, { error: 'list.limit is 1 to 50' }),
          sort: z.string().min(1).optional(),
          where: z.record(z.string(), z.unknown()).optional(),
        })
        .optional(),
      form: ref.optional(),
      as: z.string().optional(),
      class: z.string().optional(),
      variant: z
        .string()
        .regex(VARIANT_REF_RE, { error: 'a variant is written group.name, as declared in theme.yaml' })
        .optional(),
      if: z
        .union([
          ref,
          z.strictObject({
            field: z.string().min(1),
            equals: z.unknown().optional(),
            not: z.unknown().optional(),
          }),
        ])
        .optional(),
      children: z.array(LayoutNodeSchema).optional(),
      priority: z.boolean().optional(),
      sizes: z.string().min(1).optional(),
      size: z.int().positive().optional(),
    })
    .superRefine(refineNode),
)

export const LayoutSchema = z.array(LayoutNodeSchema).min(1, { error: 'layout needs at least one node' })
