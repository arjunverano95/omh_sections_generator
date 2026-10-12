import { z } from 'zod'

import { TEMPLATE_NAME_RE } from './common'

/** `templates/<name>/template.yaml` */
export const ManifestSchema = z.strictObject({
  kind: z.literal('template').optional(),
  name: z
    .string()
    .regex(TEMPLATE_NAME_RE, { error: 'template names use lowercase letters, digits and hyphens' }),
  label: z.string().min(1, { error: 'label is the human name of the face' }),
  description: z.string().optional(),
  theme: z.string().min(1, { error: 'theme is a path relative to template.yaml' }),
  globals: z.strictObject({
    header: z.string().min(1),
    footer: z.string().min(1),
  }),
  sections: z.string().min(1, { error: 'sections is a folder path relative to template.yaml' }),
})

export type ManifestFile = z.infer<typeof ManifestSchema>
