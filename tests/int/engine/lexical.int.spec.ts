import { describe, expect, it } from 'vitest'

import configPromise from '@/payload.config'
import { createMarkdownConverter } from '@/engine/seed/lexical'

type TextNode = { type: string; text?: string; format?: number }
type State = { root: { children: { type: string; tag?: string; children?: TextNode[] }[] } }

describe('createMarkdownConverter', () => {
  it('converts Markdown with the editor of the named collection field', async () => {
    const toLexical = createMarkdownConverter(await configPromise)
    const state = toLexical('Hello **there**', { collection: 'posts', fieldPath: ['content'] }) as State

    const [paragraph] = state.root.children
    expect(paragraph?.type).toBe('paragraph')
    expect(paragraph?.children?.map((node) => [node.text, node.format])).toEqual([
      ['Hello ', 0],
      ['there', 1],
    ])
  })

  it('reaches a rich text field inside an array row', async () => {
    const toLexical = createMarkdownConverter(await configPromise)
    const state = toLexical('Thanks', { collection: 'forms', fieldPath: ['emails', 'message'] }) as State

    expect(state.root.children[0]?.children?.[0]?.text).toBe('Thanks')
  })

  it('names the target when it is not a rich text field', async () => {
    const toLexical = createMarkdownConverter(await configPromise)

    expect(() => toLexical('x', { collection: 'pages', fieldPath: ['title'] })).toThrow(/No richText field at .*"title"/)
    expect(() => toLexical('x', { global: 'nowhere', fieldPath: ['body'] })).toThrow(/No richText field/)
    expect(() => toLexical('x', { block: 'no-such-block', fieldPath: ['body'] })).toThrow(/No richText field/)
  })
})
