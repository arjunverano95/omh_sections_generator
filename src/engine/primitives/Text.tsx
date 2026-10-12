import React from 'react'

import type { PrimitiveProps } from '@/engine/render/registry'
import type { TextNode } from '@/engine/render/types'

import { isRef } from '@/engine/render/types'
import { isEmpty, resolve } from '@/engine/render/scope'
import { formatDateTime } from '@/utilities/formatDateTime'

/** A full ISO date (`2026-10-12`) or timestamp (`2026-10-12T09:30:00.000Z`), as Payload stores dates. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/

function toText(value: unknown): string | undefined {
  if (typeof value === 'number') return String(value)
  if (typeof value !== 'string') return undefined
  if (ISO_DATE.test(value) && !Number.isNaN(Date.parse(value))) return formatDateTime(value)
  return value
}

export function Text({ node, scope }: PrimitiveProps<TextNode>) {
  const value = isRef(node.source) ? resolve(node.source, scope) : node.source.value
  if (isEmpty(value)) return null

  // `labels` is present only for a select whose option labels differ from the stored values.
  const text = toText(node.labels?.[String(value)] ?? value)
  if (text === undefined) return null

  const Tag = node.as
  return <Tag className={node.className}>{text}</Tag>
}
