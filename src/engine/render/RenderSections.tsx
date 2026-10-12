import React, { Fragment } from 'react'

import type { ScopeObject } from './types'

import { plans } from '@/generated/sections/plan'
import { RenderTree } from './RenderTree'
import { reportPlanError } from './planError'

/**
 * What a layout row is to the renderer. Kept to the two known keys (no index signature) so the
 * generated `Page['layout']` interfaces are assignable; a row still scopes as a ScopeObject.
 */
type Row = { blockType: string; id?: string | null }

/** Renders a page's `layout`: each row through the plan compiled for its block type. */
export function RenderSections({ blocks }: { blocks?: Row[] | null }) {
  if (!blocks?.length) return null

  return blocks.map((row, index) => {
    const plan = plans[row.blockType]
    if (!plan) {
      reportPlanError(`No render plan for block type "${row.blockType}".`)
      return null
    }

    return (
      <Fragment key={row.id ?? index}>
        <RenderTree nodes={plan} scope={[row as ScopeObject]} />
      </Fragment>
    )
  })
}
