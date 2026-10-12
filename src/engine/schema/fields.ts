import { z } from 'zod'

import { FIELD_TYPES, type FieldType } from '../manifest'
import { FIELD_NAME_RE, RELATION_COLLECTIONS, RESERVED_FIELD_NAMES, toCamelCase } from './common'

type CommonOptions = {
  label?: string
  required?: boolean
  default?: unknown
  help?: string
}

export type SelectOption = string | number | { value: string | number; label: string }

/** The long form of a field: `{ type, ...options }`. */
export type LongFormField = CommonOptions &
  (
    | { type: 'text'; maxLength?: number }
    | { type: 'textarea'; maxLength?: number }
    | { type: 'richText' }
    | { type: 'image' }
    | { type: 'icon' }
    | { type: 'link' }
    | { type: 'select'; options: SelectOption[] }
    | { type: 'number'; min?: number; max?: number }
    | { type: 'checkbox' }
    | { type: 'array'; fields: FieldsRecord; min?: number; max?: number; rowLabel?: string }
    | { type: 'form' }
    | { type: 'relation'; to: (typeof RELATION_COLLECTIONS)[number]; many?: boolean }
  )

/** `name: type` or `name: { type, ...options }`. */
export type FieldDef = FieldType | LongFormField
export type FieldsRecord = Record<string, FieldDef>

const common = {
  label: z.string().min(1).optional(),
  required: z.boolean().optional(),
  default: z.unknown().optional(),
  help: z.string().min(1).optional(),
}

const positiveInt = z.int().positive()

export const SelectOptionSchema = z.union([
  z.string().min(1),
  z.number(),
  z.strictObject({ value: z.union([z.string().min(1), z.number()]), label: z.string().min(1) }),
])

/** Validates the names in a `fields` map: camelCase, not reserved, at least one. */
function refineFieldNames(record: Record<string, unknown>, ctx: z.RefinementCtx): void {
  const names = Object.keys(record)
  if (names.length === 0) {
    ctx.addIssue({ code: 'custom', message: 'fields needs at least one field' })
    return
  }
  for (const name of names) {
    if ((RESERVED_FIELD_NAMES as readonly string[]).includes(name)) {
      ctx.addIssue({
        code: 'custom',
        path: [name],
        message: `"${name}" is a reserved field name in Payload; choose another name`,
      })
    } else if (!FIELD_NAME_RE.test(name)) {
      const fix = toCamelCase(name)
      const hint = FIELD_NAME_RE.test(fix) && fix !== name ? `; use "${fix}"` : ''
      ctx.addIssue({
        code: 'custom',
        path: [name],
        message: `"${name}" is not a camelCase identifier (letters and digits, starting with a lowercase letter)${hint}`,
      })
    }
  }
}

export const FieldsRecordSchema: z.ZodType<FieldsRecord> = z.lazy(() =>
  z.record(z.string(), FieldSchema).superRefine(refineFieldNames),
)

export const LongFormFieldSchema: z.ZodType<LongFormField> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('text'), ...common, maxLength: positiveInt.optional() }),
    z.strictObject({ type: z.literal('textarea'), ...common, maxLength: positiveInt.optional() }),
    z.strictObject({ type: z.literal('richText'), ...common }),
    z.strictObject({ type: z.literal('image'), ...common }),
    z.strictObject({ type: z.literal('icon'), ...common }),
    z.strictObject({ type: z.literal('link'), ...common }),
    z.strictObject({
      type: z.literal('select'),
      ...common,
      options: z.array(SelectOptionSchema).min(1, { error: 'a select needs at least one option' }),
    }),
    z.strictObject({ type: z.literal('number'), ...common, min: z.number().optional(), max: z.number().optional() }),
    z.strictObject({ type: z.literal('checkbox'), ...common }),
    z.strictObject({
      type: z.literal('array'),
      ...common,
      fields: FieldsRecordSchema,
      min: z.int().nonnegative().optional(),
      max: positiveInt.optional(),
      rowLabel: z.string().min(1).optional(),
    }),
    z.strictObject({ type: z.literal('form'), ...common }),
    z.strictObject({
      type: z.literal('relation'),
      ...common,
      to: z.enum(RELATION_COLLECTIONS, {
        error: `relation.to is one of ${RELATION_COLLECTIONS.join(', ')}`,
      }),
      many: z.boolean().optional(),
    }),
  ]),
)

/** Types with nothing mandatory beside the type, so `name: type` is enough. */
export const SHORTHAND_TYPES = FIELD_TYPES.filter(
  (type): type is Exclude<FieldType, 'select' | 'array' | 'relation'> =>
    type !== 'select' && type !== 'array' && type !== 'relation',
)

export const FieldSchema: z.ZodType<FieldDef> = z.lazy(() =>
  z.union([
    z.enum(SHORTHAND_TYPES, {
      error: `a field type is one of ${FIELD_TYPES.join(', ')}; select, array and relation take the long form { type, ... }`,
    }),
    LongFormFieldSchema,
  ]),
)
