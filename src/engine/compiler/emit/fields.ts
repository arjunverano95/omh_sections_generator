/**
 * Template fields to Payload field configs (compiler.md section 4, "Field mapping").
 */

import type { NField } from '../normalise'
import { printInline, printString, raw, type Raw } from './print'

/** Which hand-written helpers the emitted fields call, so the module imports only those. */
export type HelperUse = { iconField: boolean; linkField: boolean; rowLabel: boolean; defaultLexical: boolean }

export function newHelperUse(): HelperUse {
  return { iconField: false, linkField: false, rowLabel: false, defaultLexical: false }
}

type Printable = Record<string, unknown> | Raw

function admin(field: NField, extra: Record<string, unknown> = {}): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = { ...extra }
  if (field.help) out.description = field.help
  return Object.keys(out).length ? out : undefined
}

export function toPayloadField(field: NField, use: HelperUse): Printable {
  const required = field.required ? true : undefined
  const defaultValue = field.default
  switch (field.type) {
    case 'text':
    case 'textarea':
      return {
        name: field.name,
        type: field.type,
        label: field.label,
        required,
        defaultValue,
        maxLength: field.maxLength,
        admin: admin(field),
      }
    case 'richText':
      use.defaultLexical = true
      return {
        name: field.name,
        type: 'richText',
        label: field.label,
        required,
        editor: raw('defaultLexical'),
        admin: admin(field),
      }
    case 'image':
      return {
        name: field.name,
        type: 'upload',
        relationTo: 'media',
        label: field.label,
        required,
        admin: admin(field),
      }
    case 'icon':
      use.iconField = true
      return raw(
        `iconField(${printString(field.name)}, ${printInline({
          label: field.label,
          required,
          defaultValue,
          admin: admin(field),
        })})`,
      )
    case 'link':
      use.linkField = true
      return raw(
        `linkField(${printString(field.name)}, ${printInline({ label: field.label, required, admin: admin(field) })})`,
      )
    case 'select':
      return {
        name: field.name,
        type: 'select',
        label: field.label,
        required,
        defaultValue,
        options: (field.options ?? []).map((o) => ({ label: o.label, value: o.value })),
        admin: admin(field),
      }
    case 'number':
      return {
        name: field.name,
        type: 'number',
        label: field.label,
        required,
        defaultValue,
        min: field.min,
        max: field.max,
        admin: admin(field),
      }
    case 'checkbox':
      return {
        name: field.name,
        type: 'checkbox',
        label: field.label,
        required,
        defaultValue,
        admin: admin(field),
      }
    case 'array': {
      const extra: Record<string, unknown> = { initCollapsed: true }
      if (field.rowLabel) {
        use.rowLabel = true
        extra.components = { RowLabel: raw(`rowLabel(${printString(field.rowLabel)})`) }
      }
      return {
        name: field.name,
        type: 'array',
        label: field.label,
        required,
        minRows: field.min,
        maxRows: field.max,
        fields: (field.fields ?? []).map((inner) => toPayloadField(inner, use)),
        admin: admin(field, extra),
      }
    }
    case 'form':
      return {
        name: field.name,
        type: 'relationship',
        relationTo: 'forms',
        label: field.label,
        required,
        admin: admin(field),
      }
    case 'relation':
      return {
        name: field.name,
        type: 'relationship',
        relationTo: field.to,
        hasMany: field.many ? true : undefined,
        label: field.label,
        required,
        admin: admin(field),
      }
  }
}
