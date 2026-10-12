import { z } from 'zod'

import { GlobalFileSchema, SectionFileSchema } from './section'
import { ThemeSchema } from './theme'

export * from './common'
export * from './fields'
export * from './layout'
export * from './section'
export * from './seed'
export * from './theme'

/**
 * Every file under templates/ that the compiler reads. One schema serves `templates/schema.json`,
 * so a `# yaml-language-server: $schema=../schema.json` comment validates any of them; the
 * editor picks the branch by shape (and by `kind` where a file carries one).
 */
export const TemplateFileSchema = z.union([ThemeSchema, SectionFileSchema, GlobalFileSchema])

/** The JSON Schema written to `templates/schema.json`, generated from the definitions above. */
export function toJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(TemplateFileSchema, {
    target: 'draft-7',
    io: 'input',
    unrepresentable: 'any',
  }) as Record<string, unknown>
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Sections engine template file',
    description: 'A theme (theme.yaml), section (sections/*.yaml) or global (globals/*.yaml) file.',
    ...schema,
  }
}
