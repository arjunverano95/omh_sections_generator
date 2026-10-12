import React, { Fragment } from 'react'
import config from '@payload-config'
import { getPayload, type Where } from 'payload'

import type { PrimitiveProps } from '@/engine/render/registry'
import type { ListCollection, ListNode, Scope, ScopeObject } from '@/engine/render/types'

import { RenderTree } from '@/engine/render/RenderTree'
import { isWherePlaceholder } from '@/engine/render/types'
import { isEmpty, resolve } from '@/engine/render/scope'

/** Marks a clause whose placeholder resolved empty; the enclosing clause is removed. */
const DROP = Symbol('drop')

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A populated relation stands in a query as its id. */
const asQueryValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(asQueryValue)
  if (isObject(value) && 'id' in value) return value.id
  return value
}

/**
 * Replaces each `{ field }` placeholder with the scope's value. A placeholder that resolves
 * empty drops the clause holding it; an `and`/`or` left with no clauses drops in turn.
 */
function fill(value: unknown, scope: Scope): unknown {
  if (isWherePlaceholder(value)) {
    const resolved = resolve({ path: value.field.split('.') }, scope)
    return isEmpty(resolved) ? DROP : asQueryValue(resolved)
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => fill(item, scope)).filter((item) => item !== DROP)
    return value.length > 0 && items.length === 0 ? DROP : items
  }

  if (isObject(value)) {
    const entries = Object.entries(value)
    const kept = entries
      .map(([key, item]) => [key, fill(item, scope)] as const)
      .filter(([, item]) => item !== DROP)
    return entries.length > 0 && kept.length === 0 ? DROP : Object.fromEntries(kept)
  }

  return value
}

export function fillWhere(
  where: Record<string, unknown> | undefined,
  scope: Scope,
): Where | undefined {
  if (!where) return undefined
  const filled = fill(where, scope)
  return filled === DROP || !isObject(filled) || Object.keys(filled).length === 0
    ? undefined
    : (filled as Where)
}

/** The public URL of a listed document, so a template can link to it like any field. */
export function urlFor(collection: ListCollection, doc: ScopeObject): string | undefined {
  const slug = typeof doc.slug === 'string' ? doc.slug : undefined
  if (!slug) return undefined
  if (collection === 'posts') return `/posts/${slug}`
  if (collection === 'pages') return slug === 'home' ? '/' : `/${slug}`
  // Categories have no public route in this site.
  return undefined
}

/** Queries a collection and renders its children once per document, the document innermost. */
export async function List({ node, scope }: PrimitiveProps<ListNode>) {
  const { collection, limit, sort, where, select } = node.query

  const filled = fillWhere(where, scope)
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection,
    limit,
    ...(sort ? { sort } : {}),
    ...(filled ? { where: filled } : {}),
    select,
    depth: 1,
    draft: false,
    overrideAccess: false,
  } as Parameters<typeof payload.find>[0])

  const docs = result.docs as unknown as ScopeObject[]
  if (docs.length === 0) return null

  const items = docs.map((doc, index) => {
    const url = urlFor(collection, doc)
    const row: ScopeObject = url ? { ...doc, url } : doc
    return (
      <Fragment key={typeof doc.id === 'string' || typeof doc.id === 'number' ? doc.id : index}>
        <RenderTree nodes={node.children} scope={[row, ...scope]} />
      </Fragment>
    )
  })

  if (!node.as) return items

  const Tag = node.as
  return <Tag className={node.className}>{items}</Tag>
}
