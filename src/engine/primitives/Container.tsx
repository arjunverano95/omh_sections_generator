import React from 'react'

import type { PrimitiveProps } from '@/engine/render/registry'
import type { ContainerNode } from '@/engine/render/types'

import { RenderTree } from '@/engine/render/RenderTree'

export function Container({ node, scope }: PrimitiveProps<ContainerNode>) {
  const Tag = node.as
  return (
    <Tag className={node.className}>
      <RenderTree nodes={node.children} scope={scope} />
    </Tag>
  )
}
