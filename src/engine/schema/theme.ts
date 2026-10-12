import { z } from 'zod'

import { COLOR_SLOTS, CSS_LENGTH_RE, REQUIRED_LIGHT_SLOTS } from './common'

/** A Google Fonts family name, or the long form with weights and subsets. */
export const FontSpecSchema = z.union([
  z.string().min(1, { error: 'a font is a Google Fonts family name' }),
  z.strictObject({
    family: z.string().min(1),
    weights: z.array(z.int().min(100).max(900)).min(1).optional(),
    subsets: z.array(z.string().min(1)).min(1).optional(),
  }),
])
export type FontSpec = z.infer<typeof FontSpecSchema>

const colorSetShape = Object.fromEntries(
  COLOR_SLOTS.map((slot) => [slot, z.string().min(1).optional()]),
) as Record<(typeof COLOR_SLOTS)[number], z.ZodOptional<z.ZodString>>

/** One set of colour tokens; only known slots, any CSS colour syntax. */
export const ColorSetSchema = z.strictObject(colorSetShape)
export type ColorSet = z.infer<typeof ColorSetSchema>

/** A class preset: `variants.<group>.<name>`. */
export const VariantsSchema = z.record(
  z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, { error: 'variant groups are identifiers' }),
  z.record(
    z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, { error: 'variant names are identifiers' }),
    z.string({ error: 'a variant is a string of classes' }),
  ),
)

/** `templates/<name>/theme.yaml` */
export const ThemeSchema = z.strictObject({
  kind: z.literal('theme').optional(),
  fonts: z.strictObject({
    sans: FontSpecSchema,
    heading: FontSpecSchema.optional(),
  }),
  colors: z.strictObject({
    light: ColorSetSchema.superRefine((set, ctx) => {
      for (const slot of REQUIRED_LIGHT_SLOTS) {
        if (!set[slot]) {
          ctx.addIssue({
            code: 'custom',
            message: `colors.light must set ${REQUIRED_LIGHT_SLOTS.join(', ')}; "${slot}" is missing`,
          })
        }
      }
    }),
    dark: ColorSetSchema.optional(),
  }),
  radius: z
    .string()
    .regex(CSS_LENGTH_RE, { error: 'radius is a CSS length such as 0.5rem or 8px' })
    .optional(),
  variants: VariantsSchema.optional(),
})

export type ThemeFile = z.infer<typeof ThemeSchema>
