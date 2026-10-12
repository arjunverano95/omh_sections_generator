import React from 'react'

import type { PrimitiveProps } from '@/engine/render/registry'
import type { IconNode } from '@/engine/render/types'

import { ICONS, type IconName } from '@/engine/icons'
import { iconComponents } from '@/engine/payload/iconComponents'
import { resolve } from '@/engine/render/scope'

const isIconName = (value: unknown): value is IconName =>
  typeof value === 'string' && Object.hasOwn(ICONS, value)

export function Icon({ node, scope }: PrimitiveProps<IconNode>) {
  const value = resolve(node.source, scope)
  if (!isIconName(value)) return null

  const Component = iconComponents[value]
  return <Component aria-hidden="true" className={node.className} size={node.size ?? 20} />
}
