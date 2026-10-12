/**
 * Diagnostics: what the compiler reports, and how it prints them (compiler.md section 6).
 */

export type Position = { line: number; col: number }
export type Severity = 'error' | 'warning'
export type PathSegment = string | number

export type Diagnostic = {
  severity: Severity
  /** Repository-relative, forward slashes. */
  file: string
  position?: Position
  /** Document path: `layout[0].children[1].text`. Empty for whole-file problems. */
  path: string
  message: string
  /** A follow-up line when the compiler can suggest the fix. */
  hint?: string
}

export function pathToString(path: readonly PathSegment[]): string {
  let out = ''
  for (const segment of path) {
    if (typeof segment === 'number') out += `[${segment}]`
    else out += out ? `.${segment}` : segment
  }
  return out
}

export function formatDiagnostic(d: Diagnostic): string {
  const where = d.position ? `${d.file}:${d.position.line}:${d.position.col}` : d.file
  const lines = [`${d.severity === 'warning' ? 'warning: ' : ''}${where}`]
  if (d.path) lines.push(`  ${d.path}`)
  lines.push(`  ${d.message}`)
  if (d.hint) lines.push(`  ${d.hint}`)
  return lines.join('\n')
}

/** Levenshtein distance, for "Did you mean" hints. */
function distance(a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  const prev: number[] = Array.from({ length: cols }, (_, j) => j)
  for (let i = 1; i < rows; i++) {
    let diagonal = prev[0]!
    prev[0] = i
    for (let j = 1; j < cols; j++) {
      const temp = prev[j]!
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diagonal + cost)
      diagonal = temp
    }
  }
  return prev[cols - 1]!
}

/** The candidate closest to `name`, when it is close enough to be a typo. */
export function closest(name: string, candidates: Iterable<string>): string | undefined {
  let best: string | undefined
  let bestDistance = Infinity
  const lower = name.toLowerCase()
  for (const candidate of candidates) {
    if (candidate === name) continue
    const d = distance(lower, candidate.toLowerCase())
    if (d < bestDistance) {
      bestDistance = d
      best = candidate
    }
  }
  if (best === undefined) return undefined
  const allowance = Math.max(2, Math.floor(name.length / 3))
  return bestDistance <= allowance ? best : undefined
}

export function didYouMean(name: string, candidates: Iterable<string>): string | undefined {
  const match = closest(name, candidates)
  return match ? `Did you mean "${match}"?` : undefined
}

/** Collects diagnostics for one compile; nothing stops at the first error. */
export class Diagnostics {
  readonly items: Diagnostic[] = []

  error(d: Omit<Diagnostic, 'severity'>): void {
    this.items.push({ severity: 'error', ...d })
  }

  warning(d: Omit<Diagnostic, 'severity'>): void {
    this.items.push({ severity: 'warning', ...d })
  }

  get errors(): Diagnostic[] {
    return this.items.filter((d) => d.severity === 'error')
  }

  get warnings(): Diagnostic[] {
    return this.items.filter((d) => d.severity === 'warning')
  }

  get hasErrors(): boolean {
    return this.items.some((d) => d.severity === 'error')
  }

  /** Errors first, then warnings, each group in file and position order. */
  sorted(): Diagnostic[] {
    const rank = (d: Diagnostic) => (d.severity === 'error' ? 0 : 1)
    return [...this.items].sort(
      (a, b) =>
        rank(a) - rank(b) ||
        a.file.localeCompare(b.file) ||
        (a.position?.line ?? 0) - (b.position?.line ?? 0) ||
        (a.position?.col ?? 0) - (b.position?.col ?? 0),
    )
  }
}

/** Thrown by `compile()` callers that want an exception instead of a result. */
export class CompileFailure extends Error {
  constructor(public readonly diagnostics: Diagnostic[]) {
    super(
      `${diagnostics.filter((d) => d.severity === 'error').length} template error(s):\n` +
        diagnostics.map(formatDiagnostic).join('\n\n'),
    )
    this.name = 'CompileFailure'
  }
}
