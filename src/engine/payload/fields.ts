import type { SelectField } from 'payload'

import { ICON_NAMES } from '@/engine/icons'

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
