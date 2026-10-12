/**
 * Scopes, references, variants, conditions and list selects (template-format.md section 6).
 * Turns validated layout nodes into plan nodes; every semantic rule lives here.
 */

import type {
  ButtonLiteral,
  Condition,
  ContainerTag,
  ListCollection,
  Plan,
  PlanNode,
  Ref,
  Source,
  TextTag,
} from '../render/types'
import { isWherePlaceholder } from '../render/types'
import type { LayoutButtonLiteral, LayoutCondition, LayoutNode } from '../schema/layout'
import { primitiveOf } from '../schema/layout'
import {
  childFields,
  COLLECTION_FIELDS,
  describeType,
  HREF_ACCEPTS,
  PRIMITIVE_ACCEPTS,
  sortableFields,
  type ScopeField,
  type ScopeFieldType,
} from './collections'
import { didYouMean, pathToString, type Diagnostics, type PathSegment } from './errors'
import type { LoadedFile } from './load'
import type { NTheme } from './normalise'

export type Scope = {
  kind: 'section' | 'row' | 'doc'
  /** For messages: `section "hero-split"`, `rows of "items"`, `documents of "posts"`. */
  label: string
  fields: Record<string, ScopeField>
  /** `doc` scopes collect the fields their children reference. */
  select?: SelectTree
}

export type SelectTree = { [key: string]: true | SelectTree }

export type ResolveContext = {
  file: LoadedFile
  diagnostics: Diagnostics
  theme: NTheme
  /** `group.name` strings referenced anywhere; unused variants warn at the end. */
  usedVariants: Set<string>
  /** Declared fields referenced at least once, keyed by the scope's field map. */
  referenced: Map<Record<string, ScopeField>, Set<string>>
}

type Resolved = { ref: Ref; field: ScopeField }

function errorAt(ctx: ResolveContext, path: PathSegment[], message: string, hint?: string): void {
  ctx.diagnostics.error({
    file: ctx.file.file,
    position: ctx.file.positionOf(path),
    path: pathToString(path),
    message,
    hint,
  })
}

function warnAt(ctx: ResolveContext, path: PathSegment[], message: string, hint?: string): void {
  ctx.diagnostics.warning({
    file: ctx.file.file,
    position: ctx.file.positionOf(path),
    path: pathToString(path),
    message,
    hint,
  })
}

export function markReferenced(ctx: ResolveContext, fields: Record<string, ScopeField>, name: string): void {
  let set = ctx.referenced.get(fields)
  if (!set) {
    set = new Set()
    ctx.referenced.set(fields, set)
  }
  set.add(name)
}

function addSelect(tree: SelectTree, segments: string[], fields: Record<string, ScopeField>): void {
  let node = tree
  let scope: Record<string, ScopeField> | undefined = fields
  for (let i = 0; i < segments.length; i++) {
    const name = segments[i]!
    const field: ScopeField | undefined = scope?.[name]
    if (!field) return
    if (field.type === 'url') {
      node['slug'] = true
      return
    }
    const last = i === segments.length - 1
    if (field.type === 'group' && !last) {
      const existing = node[name]
      if (existing === true) return
      const next: SelectTree = existing ?? {}
      node[name] = next
      node = next
      scope = field.fields
      continue
    }
    node[name] = true
    return
  }
}

/**
 * Resolves `a.b.c` against the scope chain, innermost first, and type-checks the result
 * against what the primitive accepts.
 */
export function resolveRef(
  reference: string,
  scopes: Scope[],
  ctx: ResolveContext,
  path: PathSegment[],
  accepts: readonly ScopeFieldType[] | undefined,
  taker: string,
): Resolved | undefined {
  const segments = reference.split('.')
  const first = segments[0]!
  const depth = scopes.findIndex((scope) => Object.hasOwn(scope.fields, first))
  if (depth < 0) {
    const candidates = new Set<string>()
    for (const scope of scopes) for (const name of Object.keys(scope.fields)) candidates.add(name)
    const enclosing = scopes
      .slice(1)
      .map((s) => s.label)
      .join(', ')
    errorAt(
      ctx,
      path,
      `"${first}" is not a field of ${scopes[0]!.label}${enclosing ? ` or of the enclosing ${enclosing}` : ''}`,
      didYouMean(first, candidates),
    )
    return undefined
  }

  const scope = scopes[depth]!
  markReferenced(ctx, scope.fields, first)

  let field = scope.fields[first]!
  let reached = first
  for (const segment of segments.slice(1)) {
    const children = childFields(field)
    if (!children) {
      const why =
        field.type === 'array'
          ? `"${reached}" is an array; iterate it with each`
          : field.type === 'relation' && field.many
            ? `"${reached}" is a list of documents; a dot path cannot reach into it`
            : `"${reached}" is a ${describeType(field)} field and has no properties`
      errorAt(ctx, path, `${why}, so "${reference}" cannot be resolved`)
      return undefined
    }
    const next = children[segment]
    if (!next) {
      errorAt(
        ctx,
        path,
        `"${segment}" is not a property of "${reached}" (${describeType(field)}); the properties are ${Object.keys(children).join(', ')}`,
        didYouMean(segment, Object.keys(children)),
      )
      return undefined
    }
    field = next
    reached = `${reached}.${segment}`
  }

  if (accepts && !accepts.includes(field.type)) {
    errorAt(
      ctx,
      path,
      `"${reference}" is a ${describeType(field)} field; ${taker} takes ${accepts.join(', ')}`,
    )
    return undefined
  }

  if (scope.kind === 'doc' && scope.select) addSelect(scope.select, segments, scope.fields)

  return { ref: { path: segments, depth }, field }
}

function resolveVariant(variant: string | undefined, ctx: ResolveContext, path: PathSegment[]): string | undefined {
  if (!variant) return undefined
  const [group, name] = variant.split('.') as [string, string]
  const classes = ctx.theme.variants[group]?.[name]
  if (classes === undefined) {
    const all: string[] = []
    for (const [g, names] of Object.entries(ctx.theme.variants)) for (const n of Object.keys(names)) all.push(`${g}.${n}`)
    errorAt(
      ctx,
      [...path, 'variant'],
      `"${variant}" is not a variant in theme.yaml${all.length ? `; the variants are ${all.join(', ')}` : ''}`,
      didYouMean(variant, all),
    )
    return undefined
  }
  ctx.usedVariants.add(variant)
  return classes
}

function mergeClasses(...parts: (string | undefined)[]): string | undefined {
  const merged = parts
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
  return merged || undefined
}

function resolveCondition(
  condition: LayoutCondition,
  scopes: Scope[],
  ctx: ResolveContext,
  path: PathSegment[],
): Condition | undefined {
  const at = [...path, 'if']
  if (typeof condition === 'string') {
    const resolved = resolveRef(condition, scopes, ctx, at, undefined, 'if')
    return resolved ? { path: resolved.ref.path, depth: resolved.ref.depth } : undefined
  }

  const resolved = resolveRef(condition.field, scopes, ctx, [...at, 'field'], undefined, 'if')
  if (!resolved) return undefined
  const op: 'equals' | 'not' = condition.equals !== undefined ? 'equals' : 'not'
  const raw = op === 'equals' ? condition.equals : condition.not
  const { field } = resolved
  let value: unknown = raw

  const reject = (wanted: string) =>
    errorAt(ctx, [...at, op], `${op} on the ${describeType(field)} field "${condition.field}" takes ${wanted}`)

  switch (field.type) {
    case 'select': {
      if (typeof raw !== 'string' && typeof raw !== 'number') {
        reject(`one of its options (${(field.options ?? []).map((o) => o.value).join(', ')})`)
        return undefined
      }
      value = String(raw)
      if (!(field.options ?? []).some((o) => o.value === value)) {
        reject(`one of its options (${(field.options ?? []).map((o) => o.value).join(', ')})`)
        return undefined
      }
      break
    }
    case 'checkbox':
      if (typeof raw !== 'boolean') {
        reject('true or false')
        return undefined
      }
      break
    case 'number':
      if (typeof raw !== 'number') {
        reject('a number')
        return undefined
      }
      break
    case 'text':
    case 'textarea':
      if (typeof raw !== 'string') {
        reject('a string')
        return undefined
      }
      break
    default:
      errorAt(
        ctx,
        [...at, op],
        `${op} is not supported on a ${describeType(field)} field; use the bare form (if: ${condition.field}) to test for a value`,
      )
      return undefined
  }

  const out: Condition = { path: resolved.ref.path, depth: resolved.ref.depth }
  out[op] = value
  return out
}

function checkWherePlaceholders(
  where: Record<string, unknown>,
  scopes: Scope[],
  ctx: ResolveContext,
  path: PathSegment[],
): void {
  const section = scopes[scopes.length - 1]!
  const walk = (value: unknown, at: PathSegment[]): void => {
    if (isWherePlaceholder(value)) {
      if (!Object.hasOwn(section.fields, value.field)) {
        errorAt(
          ctx,
          at,
          `where placeholder "${value.field}" is not a field of ${section.label}`,
          didYouMean(value.field, Object.keys(section.fields)),
        )
      } else {
        markReferenced(ctx, section.fields, value.field)
      }
      return
    }
    if (Array.isArray(value)) value.forEach((item, i) => walk(item, [...at, i]))
    else if (value && typeof value === 'object')
      for (const [key, item] of Object.entries(value)) walk(item, [...at, key])
  }
  walk(where, path)
}

/** Deterministic output: object keys sorted recursively (arrays keep their order). */
export function sortKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(sortKeys) as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key])
    }
    return out as T
  }
  return value
}

function nodeAs(node: LayoutNode): string | undefined {
  return node.as
}

type ResolveOptions = { expectLi: boolean }

export function resolveLayout(
  layout: LayoutNode[],
  scopes: Scope[],
  ctx: ResolveContext,
  path: PathSegment[],
  options: ResolveOptions = { expectLi: false },
): Plan {
  const plan: Plan = []
  layout.forEach((node, index) => {
    const resolved = resolveNode(node, scopes, ctx, [...path, index], options)
    if (resolved) plan.push(resolved)
  })
  return plan
}

function resolveNode(
  node: LayoutNode,
  scopes: Scope[],
  ctx: ResolveContext,
  path: PathSegment[],
  options: ResolveOptions,
): PlanNode | undefined {
  const primitive = primitiveOf(node as Record<string, unknown>)
  if (Array.isArray(primitive)) return undefined // the schema pass already reported it

  const className = mergeClasses(resolveVariant(node.variant, ctx, path), primitive === 'div' ? node.div : node.class)
  const condition = node.if !== undefined ? resolveCondition(node.if, scopes, ctx, path) : undefined
  const common = {
    ...(className ? { className } : {}),
    ...(condition ? { if: condition } : {}),
  }

  const isList = primitive === 'each' || primitive === 'list'
  const transparent = isList && !node.as
  if (options.expectLi && !transparent && nodeAs(node) !== 'li') {
    warnAt(
      ctx,
      path,
      `children of a ul or ol are expected to be li nodes; this ${primitive} node renders ${nodeAs(node) ? `a ${nodeAs(node)}` : 'no li'}`,
      primitive === 'text' || primitive === 'div' ? 'add `as: li`' : 'wrap it in a `div` with `as: li`',
    )
  }
  const childOptions: ResolveOptions = {
    expectLi: node.as === 'ul' || node.as === 'ol' || (transparent && options.expectLi),
  }

  switch (primitive) {
    case 'text': {
      const value = node.text!
      const as = (node.as ?? 'p') as TextTag
      if (typeof value === 'object') {
        return { type: 'text', source: { value: String(value.value) }, as, ...common }
      }
      const resolved = resolveRef(value, scopes, ctx, [...path, 'text'], PRIMITIVE_ACCEPTS.text, 'text')
      if (!resolved) return undefined
      const labels =
        resolved.field.type === 'select' && resolved.field.options?.some((o) => o.label !== o.value)
          ? Object.fromEntries(resolved.field.options.map((o) => [o.value, o.label]))
          : undefined
      return { type: 'text', source: resolved.ref, as, ...(labels ? { labels } : {}), ...common }
    }
    case 'richText': {
      const resolved = resolveRef(node.richText!, scopes, ctx, [...path, 'richText'], PRIMITIVE_ACCEPTS.richText, 'richText')
      return resolved ? { type: 'richText', source: resolved.ref, ...common } : undefined
    }
    case 'image': {
      const resolved = resolveRef(node.image!, scopes, ctx, [...path, 'image'], PRIMITIVE_ACCEPTS.image, 'image')
      if (!resolved) return undefined
      return {
        type: 'image',
        source: resolved.ref,
        ...(node.priority ? { priority: true } : {}),
        ...(node.sizes ? { sizes: node.sizes } : {}),
        ...common,
      }
    }
    case 'icon': {
      const resolved = resolveRef(node.icon!, scopes, ctx, [...path, 'icon'], PRIMITIVE_ACCEPTS.icon, 'icon')
      if (!resolved) return undefined
      return { type: 'icon', source: resolved.ref, ...(node.size ? { size: node.size } : {}), ...common }
    }
    case 'form': {
      const resolved = resolveRef(node.form!, scopes, ctx, [...path, 'form'], PRIMITIVE_ACCEPTS.form, 'form')
      return resolved ? { type: 'form', source: resolved.ref, ...common } : undefined
    }
    case 'button': {
      const value = node.button!
      let source: Ref | ButtonLiteral | undefined
      if (typeof value === 'string') {
        source = resolveRef(value, scopes, ctx, [...path, 'button'], PRIMITIVE_ACCEPTS.button, 'button')?.ref
      } else {
        source = resolveButtonLiteral(value, scopes, ctx, [...path, 'button'])
      }
      const children = node.children ? resolveLayout(node.children, scopes, ctx, [...path, 'children']) : undefined
      if (!source) return undefined
      return { type: 'button', source, ...(children && children.length ? { children } : {}), ...common }
    }
    case 'div': {
      const children = resolveLayout(node.children ?? [], scopes, ctx, [...path, 'children'], childOptions)
      return { type: 'div', as: (node.as ?? 'div') as ContainerTag, children, ...common }
    }
    case 'each': {
      const resolved = resolveRef(node.each!, scopes, ctx, [...path, 'each'], PRIMITIVE_ACCEPTS.each, 'each')
      if (!resolved) return undefined
      const row: Scope = {
        kind: 'row',
        label: `rows of "${node.each}"`,
        fields: resolved.field.fields ?? {},
      }
      const children = resolveLayout(node.children ?? [], [row, ...scopes], ctx, [...path, 'children'], childOptions)
      return {
        type: 'each',
        source: resolved.ref,
        ...(node.as ? { as: node.as as ContainerTag } : {}),
        children,
        ...common,
      }
    }
    case 'list': {
      const query = node.list!
      const collection: ListCollection = query.collection
      if (query.sort) {
        const sortField = query.sort.replace(/^-/, '')
        const sortable = sortableFields(collection)
        if (!sortable.includes(sortField)) {
          errorAt(
            ctx,
            [...path, 'list', 'sort'],
            `"${sortField}" is not a sortable field of ${collection}; use one of ${sortable.join(', ')}`,
            didYouMean(sortField, sortable),
          )
        }
      }
      if (query.where) checkWherePlaceholders(query.where, scopes, ctx, [...path, 'list', 'where'])
      const doc: Scope = {
        kind: 'doc',
        label: `documents of "${collection}"`,
        fields: COLLECTION_FIELDS[collection],
        select: {},
      }
      const children = resolveLayout(node.children ?? [], [doc, ...scopes], ctx, [...path, 'children'], childOptions)
      const select = sortKeys({ ...doc.select, slug: true })
      return {
        type: 'list',
        query: {
          collection,
          limit: query.limit,
          ...(query.sort ? { sort: query.sort } : {}),
          ...(query.where ? { where: sortKeys(query.where) } : {}),
          select,
        },
        ...(node.as ? { as: node.as as ContainerTag } : {}),
        ...(className ? { className } : {}),
        children,
      }
    }
  }
}

function resolveButtonLiteral(
  literal: LayoutButtonLiteral,
  scopes: Scope[],
  ctx: ResolveContext,
  path: PathSegment[],
): ButtonLiteral | undefined {
  let href: Source | undefined
  if (typeof literal.href === 'string') {
    href = resolveRef(literal.href, scopes, ctx, [...path, 'href'], HREF_ACCEPTS, 'a button href')?.ref
  } else {
    href = { value: literal.href.value }
  }
  if (!href) return undefined
  return {
    ...(literal.label ? { label: literal.label } : {}),
    href,
    ...(literal.newTab ? { newTab: true } : {}),
  }
}

/** Warnings for declared fields no layout node, condition or placeholder referenced. */
export function warnUnreferenced(
  fields: Record<string, ScopeField>,
  ctx: ResolveContext,
  owner: string,
): void {
  const referenced = ctx.referenced.get(fields) ?? new Set<string>()
  for (const [name, field] of Object.entries(fields)) {
    if (!referenced.has(name)) {
      warnAt(
        ctx,
        field.path ?? ['fields', name],
        `"${name}" is declared by ${owner} but nothing in its layout references it; editors would fill in a value nothing renders`,
      )
    }
    if (field.type === 'array' && field.fields) warnUnreferenced(field.fields, ctx, `the rows of "${name}"`)
  }
}
