import React from 'react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import type { PrimitiveProps } from '@/engine/render/registry'
import type { RichTextNode } from '@/engine/render/types'

import ProjectRichText from '@/components/RichText'
import { resolve } from '@/engine/render/scope'

type LexicalNode = { type?: string; children?: LexicalNode[] }

/** An editor state with no root, no children, or only empty paragraphs is empty. */
function hasContent(value: unknown): value is SerializedEditorState {
  if (typeof value !== 'object' || value === null || !('root' in value)) return false
  const root = (value as { root?: LexicalNode }).root
  const children = root?.children ?? []
  return children.some((child) => child.type !== 'paragraph' || (child.children?.length ?? 0) > 0)
}

export function RichText({ node, scope }: PrimitiveProps<RichTextNode>) {
  const value = resolve(node.source, scope)
  if (!hasContent(value)) return null

  return (
    <ProjectRichText className={node.className} data={value} enableGutter={false} enableProse />
  )
}
