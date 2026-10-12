import { z } from 'zod'

import { GLOBAL_NAMES, SECTION_NAME_RE } from './common'
import { FieldsRecordSchema, type FieldsRecord } from './fields'
import { LayoutSchema } from './layout'

/** Rule 12: arrays nest at most one level. Reported at the innermost offending `fields`. */
function refineNesting(doc: { fields: FieldsRecord }, ctx: z.RefinementCtx): void {
  for (const [outer, outerDef] of Object.entries(doc.fields)) {
    if (typeof outerDef !== 'object' || outerDef.type !== 'array') continue
    for (const [inner, innerDef] of Object.entries(outerDef.fields)) {
      if (typeof innerDef !== 'object' || innerDef.type !== 'array') continue
      for (const [deep, deepDef] of Object.entries(innerDef.fields)) {
        if (typeof deepDef !== 'object' || deepDef.type !== 'array') continue
        ctx.addIssue({
          code: 'custom',
          path: ['fields', outer, 'fields', inner, 'fields', deep],
          message: `arrays nest at most one level; "${deep}" is an array inside the array "${inner}", which is already inside "${outer}"`,
        })
      }
    }
  }
}

const shared = {
  description: z.string().min(1).optional(),
  fields: FieldsRecordSchema,
  layout: LayoutSchema,
}

/** `templates/<name>/sections/<section>.yaml` */
export const SectionFileSchema = z
  .strictObject({
    kind: z.literal('section').optional(),
    name: z.string().regex(SECTION_NAME_RE, {
      error: 'section names are kebab-case: lowercase letters and digits separated by single hyphens',
    }),
    label: z.string().min(1, { error: 'label is what editors see in the block drawer' }),
    plural: z.string().min(1).optional(),
    group: z.string().min(1).optional(),
    preview: z.string().min(1).optional(),
    ...shared,
  })
  .superRefine(refineNesting)

export type SectionFile = z.infer<typeof SectionFileSchema>

/** `templates/<name>/globals/{header,footer}.yaml` */
export const GlobalFileSchema = z
  .strictObject({
    kind: z.literal('global', { error: 'a global file starts with kind: global' }),
    name: z.enum(GLOBAL_NAMES, { error: `a global is named ${GLOBAL_NAMES.join(' or ')}` }),
    label: z.string().min(1).optional(),
    ...shared,
  })
  .superRefine(refineNesting)

export type GlobalFile = z.infer<typeof GlobalFileSchema>
