import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { isMap, isNode, isScalar, isSeq, LineCounter, parseDocument, type Document, type Node } from 'yaml'

import { type Diagnostics, type PathSegment, type Position } from './errors'

/** A parsed YAML file that can still say where any value came from. */
export type LoadedFile<T = unknown> = {
  /** Repository-relative with forward slashes, as printed in diagnostics. */
  file: string
  absPath: string
  data: T
  /**
   * The source position of the value at `path`, or of its key with `{ key: true }`. When the
   * path does not exist (a missing required key), the deepest existing ancestor's position.
   */
  positionOf(path: readonly PathSegment[], options?: { key?: boolean }): Position | undefined
}

export function toRepoPath(absPath: string, repoRoot: string): string {
  return path.relative(repoRoot, absPath).split(path.sep).join('/')
}

function nodeAt(doc: Document, segments: readonly PathSegment[], key: boolean): Node | undefined {
  let current: unknown = doc.contents
  let last: Node | undefined = isNode(current) ? current : undefined
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!
    if (isMap(current)) {
      const pair = current.items.find((p) => isScalar(p.key) && String(p.key.value) === String(segment))
      if (!pair) return last
      if (key && i === segments.length - 1 && isNode(pair.key)) return pair.key
      current = pair.value
    } else if (isSeq(current) && typeof segment === 'number') {
      current = current.items[segment]
      if (current === undefined) return last
    } else {
      return last
    }
    if (isNode(current)) last = current
  }
  return last
}

/**
 * Parses one YAML file. Syntax errors (including duplicate keys) are reported as diagnostics
 * and `undefined` is returned; an empty document is an error too.
 */
export function loadYamlFile(absPath: string, repoRoot: string, diagnostics: Diagnostics): LoadedFile | undefined {
  const file = toRepoPath(absPath, repoRoot)
  if (!existsSync(absPath)) {
    diagnostics.error({ file, path: '', message: 'file not found' })
    return undefined
  }
  const source = readFileSync(absPath, 'utf8')
  const lineCounter = new LineCounter()
  const doc = parseDocument(source, { lineCounter, prettyErrors: true, uniqueKeys: true })

  if (doc.errors.length > 0) {
    for (const error of doc.errors) {
      const pos = error.linePos?.[0]
      diagnostics.error({
        file,
        position: pos ? { line: pos.line, col: pos.col } : undefined,
        path: '',
        message: `YAML: ${error.message.split('\n')[0]}`,
      })
    }
    return undefined
  }

  const data: unknown = doc.toJS({ maxAliasCount: 100 })
  if (data === null || data === undefined) {
    diagnostics.error({ file, path: '', message: 'the file is empty' })
    return undefined
  }

  const positionOf: LoadedFile['positionOf'] = (segments, options) => {
    const node = nodeAt(doc, segments, options?.key ?? false)
    const offset = node?.range?.[0]
    if (offset === undefined) return undefined
    const { line, col } = lineCounter.linePos(offset)
    return { line, col }
  }

  return { file, absPath, data, positionOf }
}
