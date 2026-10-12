import React from 'react'

import type { Media as MediaDocument } from '@/payload-types'
import type { PrimitiveProps } from '@/engine/render/registry'
import type { ImageNode } from '@/engine/render/types'

import { Media } from '@/components/Media'
import { isDocument, resolve } from '@/engine/render/scope'

export function Image({ node, scope }: PrimitiveProps<ImageNode>) {
  const value = resolve(node.source, scope)
  // An id without its document is an unpopulated upload: nothing to draw.
  if (!isDocument(value)) return null

  return (
    <Media
      htmlElement={null}
      imgClassName={node.className}
      priority={node.priority}
      resource={value as unknown as MediaDocument}
      size={node.sizes}
    />
  )
}
