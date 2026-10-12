import type { Field, SelectField } from 'payload'

import { ICON_NAMES } from '@/engine/icons'
import { link } from '@/fields/link'

type IconFieldOptions = {
  label: string
  required?: boolean
  defaultValue?: string
  admin?: { description?: string }
}

/** `arrow-up-right` -> `Arrow Up Right` */
const titleCase = (key: string): string =>
  key
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

const iconOptions = ICON_NAMES.map((value) => ({ value, label: titleCase(value) }))

/** A select over the curated icon vocabulary. Only the keys the caller passes are emitted. */
export function iconField(name: string, options: IconFieldOptions): SelectField {
  const { label, required, defaultValue, admin } = options

  return {
    name,
    type: 'select',
    label,
    options: iconOptions,
    ...(required !== undefined ? { required } : {}),
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    ...(admin?.description !== undefined ? { admin: { description: admin.description } } : {}),
  }
}

/** The one row label component every generated array uses; `field` names the row's title field. */
export function rowLabel(field: string) {
  return {
    path: '@/engine/payload/RowLabel#RowLabel',
    clientProps: { field },
  } as const
}

type LinkFieldOptions = {
  label: string
  required?: boolean
  admin?: { description?: string }
}

/** The inner fields the stock link group marks required. */
const LINK_REQUIRED_FIELDS = new Set(['label', 'reference', 'url'])

/** Clears `required` on the link group's own fields, inside its rows. */
function relaxLinkFields(fields: Field[]): Field[] {
  return fields.map((field) => {
    if (field.type === 'row') return { ...field, fields: relaxLinkFields(field.fields) }
    if ('name' in field && LINK_REQUIRED_FIELDS.has(field.name)) {
      return { ...field, required: false } as Field
    }
    return field
  })
}

/**
 * The stock link group without appearances. An optional link must be leavable empty, but the
 * stock group requires its label and destination, so those are relaxed unless the link itself
 * is required.
 */
export function linkField(name: string, options: LinkFieldOptions): Field {
  const { label, required, admin } = options

  const field = link({
    appearances: false,
    overrides: {
      name,
      label,
      ...(admin?.description !== undefined ? { admin: { description: admin.description } } : {}),
    },
  })

  if (required === true || field.type !== 'group') return field
  return { ...field, fields: relaxLinkFields(field.fields) }
}
