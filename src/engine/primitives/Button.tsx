import React from 'react'

import type { PrimitiveProps } from '@/engine/render/registry'
import type { ButtonNode, Scope } from '@/engine/render/types'

import { CMSLink } from '@/components/Link'
import { RenderTree } from '@/engine/render/RenderTree'
import { isButtonLiteral, isRef } from '@/engine/render/types'
import { isEmpty, resolve } from '@/engine/render/scope'

type LinkProps = Pick<
  React.ComponentProps<typeof CMSLink>,
  'type' | 'url' | 'reference' | 'label' | 'newTab'
>

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A `link` field's group, narrowed to what CMSLink reads. */
function fromGroup(group: Record<string, unknown>): LinkProps {
  return {
    type: group.type as LinkProps['type'],
    url: typeof group.url === 'string' ? group.url : null,
    reference: (group.reference as LinkProps['reference']) ?? null,
    label: typeof group.label === 'string' ? group.label : null,
    newTab: group.newTab === true,
  }
}

function linkFor(node: ButtonNode, scope: Scope): LinkProps | undefined {
  const { source } = node

  if (!isButtonLiteral(source)) {
    const group = resolve(source, scope)
    return isObject(group) && !isEmpty(group) ? fromGroup(group) : undefined
  }

  const href = isRef(source.href) ? resolve(source.href, scope) : source.href.value
  // A reference may point at a plain URL string or at a whole link group.
  const target: LinkProps | undefined =
    typeof href === 'string'
      ? { type: 'custom', url: href }
      : isObject(href) && !isEmpty(href)
        ? fromGroup(href)
        : undefined
  if (!target) return undefined

  return { ...target, label: source.label ?? null, newTab: source.newTab ?? target.newTab }
}

/**
 * A link styled only by its className (`appearance="inline"`, so no button variant leaks in).
 * CMSLink renders nothing when the link has no destination, which keeps empty links absent.
 */
export function Button({ node, scope }: PrimitiveProps<ButtonNode>) {
  const link = linkFor(node, scope)
  if (!link) return null

  if (!node.children?.length) {
    if (!link.label) return null
    return <CMSLink {...link} appearance="inline" className={node.className} />
  }

  // With children the anchor wraps them (a logo, a wordmark). The link's label names the
  // anchor for assistive technology and the children are hidden from it, which is what an
  // aria-label would do; CMSLink does not forward arbitrary attributes to its anchor.
  // `contents` keeps the wrapper out of the anchor's layout.
  const { label, ...destination } = link
  const children = <RenderTree nodes={node.children} scope={scope} />
  return (
    <CMSLink {...destination} appearance="inline" className={node.className}>
      {label ? (
        <>
          <span className="sr-only">{label}</span>
          <span aria-hidden="true" className="contents">
            {children}
          </span>
        </>
      ) : (
        children
      )}
    </CMSLink>
  )
}
