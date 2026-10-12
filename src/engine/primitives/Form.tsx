import React from 'react'
import type { Form as FormDocument } from '@payloadcms/plugin-form-builder/types'

import type { PrimitiveProps } from '@/engine/render/registry'
import type { FormNode } from '@/engine/render/types'

import { Form as ClientForm } from '@/engine/primitives/form/Form'
import { isDocument, resolve } from '@/engine/render/scope'

/** Server side of the form: hands the populated form document to the one client boundary. */
export function Form({ node, scope }: PrimitiveProps<FormNode>) {
  const value = resolve(node.source, scope)
  // An unpopulated relation or a form with no fields has nothing to render.
  if (!isDocument(value) || !Array.isArray(value.fields) || value.fields.length === 0) return null

  return <ClientForm className={node.className} form={value as unknown as FormDocument} />
}
