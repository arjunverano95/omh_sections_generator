import React from 'react'

import type { GlobalName } from '@/engine/manifest'
import type { ScopeObject } from './types'

import { plans } from '@/generated/sections/plan'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { RenderTree } from './RenderTree'
import { reportPlanError } from './planError'

/** Fetches a global (cached under `global_<slug>`) and renders its compiled plan. */
export async function RenderGlobal({ slug }: { slug: GlobalName }) {
  const plan = plans[slug]
  if (!plan) {
    reportPlanError(`No render plan for global "${slug}".`)
    return null
  }

  const data = (await getCachedGlobal(slug, 1)()) as unknown as ScopeObject

  return <RenderTree nodes={plan} scope={[data]} />
}
