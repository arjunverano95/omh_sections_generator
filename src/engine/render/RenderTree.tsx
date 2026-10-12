import React from 'react'

import type { PlanNode, Scope } from './types'

import { registry } from './registry'
import { test } from './scope'
import { reportPlanError } from './planError'

type Props = {
  nodes: PlanNode[]
  scope: Scope
}

/** Walks a layout tree: drops nodes whose `if` fails, hands the rest to their primitive. */
export function RenderTree({ nodes, scope }: Props) {
  return nodes.map((node, index) => {
    if ('if' in node && node.if && !test(node.if, scope)) return null

    const Primitive = registry[node.type] as React.ComponentType<{ node: PlanNode; scope: Scope }>
    if (!Primitive) {
      reportPlanError(`No primitive is registered for node type "${String(node.type)}".`)
      return null
    }

    return <Primitive key={index} node={node} scope={scope} />
  })
}
