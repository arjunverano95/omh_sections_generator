import type React from 'react'

import type { PlanNode, PlanNodeType, Scope } from './types'

import { Button } from '@/engine/primitives/Button'
import { Container } from '@/engine/primitives/Container'
import { Each } from '@/engine/primitives/Each'
import { Form } from '@/engine/primitives/Form'
import { Icon } from '@/engine/primitives/Icon'
import { Image } from '@/engine/primitives/Image'
import { List } from '@/engine/primitives/List'
import { RichText } from '@/engine/primitives/RichText'
import { Text } from '@/engine/primitives/Text'

/** What every primitive receives: its plan node and the scope chain, innermost first. */
export type PrimitiveProps<N extends PlanNode> = { node: N; scope: Scope }

type Registry = {
  [T in PlanNodeType]: React.ComponentType<PrimitiveProps<Extract<PlanNode, { type: T }>>>
}

/** The one place a node type meets its component. A new primitive is registered here. */
export const registry: Registry = {
  text: Text,
  richText: RichText,
  image: Image,
  icon: Icon,
  button: Button,
  div: Container,
  each: Each,
  list: List,
  form: Form,
}
