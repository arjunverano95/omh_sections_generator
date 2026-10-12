import React, { Fragment } from 'react'

import type { PrimitiveProps } from '@/engine/render/registry'
import type { EachNode, ScopeObject } from '@/engine/render/types'

import { RenderTree } from '@/engine/render/RenderTree'
import { resolve } from '@/engine/render/scope'

const isRow = (value: unknown): value is ScopeObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Renders its children once per array row, with the row as the innermost scope. */
export function Each({ node, scope }: PrimitiveProps<EachNode>) {
  const value = resolve(node.source, scope)
  const rows = Array.isArray(value) ? value.filter(isRow) : []
  if (rows.length === 0) return null

  const items = rows.map((row, index) => (
    <Fragment key={typeof row.id === 'string' || typeof row.id === 'number' ? row.id : index}>
      <RenderTree nodes={node.children} scope={[row, ...scope]} />
    </Fragment>
  ))

  if (!node.as) return items

  const Tag = node.as
  return <Tag className={node.className}>{items}</Tag>
}
