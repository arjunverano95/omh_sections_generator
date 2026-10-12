/**
 * `pnpm sections:compile [--watch] [--check] [--strict]` (compiler.md section 3).
 * Exit 0 on success, 1 on template errors, 2 on a compiler bug.
 */

import { watch } from 'node:fs'
import path from 'node:path'

import { compile, TEMPLATES_DIR, type CompileResult } from './index'
import { formatDiagnostic } from './errors'

type Args = {
  watch: boolean
  check: boolean
  strict: boolean
  help: boolean
}

const USAGE = `Usage: pnpm sections:compile [options]

  --watch   recompile when a file under ${TEMPLATES_DIR}/ changes
  --check   validate and resolve only; write nothing, report schema.json drift
  --strict  warnings fail the compile
  --help    this text
`

export function parseArgs(argv: string[]): Args {
  const args: Args = { watch: false, check: false, strict: false, help: false }
  for (const arg of argv) {
    switch (arg) {
      case '--watch':
        args.watch = true
        break
      case '--check':
        args.check = true
        break
      case '--strict':
        args.strict = true
        break
      case '--help':
      case '-h':
        args.help = true
        break
      default:
        throw new UsageError(`unknown option ${arg}`)
    }
  }
  return args
}

class UsageError extends Error {}

function report(result: CompileResult, check: boolean): void {
  const out: string[] = []
  for (const d of result.diagnostics) out.push(formatDiagnostic(d), '')
  const errors = result.diagnostics.filter((d) => d.severity === 'error').length
  const warnings = result.diagnostics.length - errors
  const counts = [errors && `${errors} error${errors === 1 ? '' : 's'}`, warnings && `${warnings} warning${warnings === 1 ? '' : 's'}`]
    .filter(Boolean)
    .join(', ')
  if (!result.ok) {
    out.push(`failed (${counts})`)
  } else if (check) {
    out.push(`ok${counts ? ` (${counts})` : ''}`)
  } else {
    const { sections } = result.site!
    const what = `${sections.length} section${sections.length === 1 ? '' : 's'} and 2 globals`
    const wrote = result.written.length ? `${result.written.length} file${result.written.length === 1 ? '' : 's'} written` : 'nothing changed'
    out.push(`${what} compiled, ${wrote}${counts ? ` (${counts})` : ''}`)
  }
  process.stdout.write(`${out.join('\n')}\n`)
}

function runOnce(repoRoot: string, args: Args): boolean {
  const result = compile({ repoRoot, check: args.check, strict: args.strict })
  report(result, args.check)
  return result.ok
}

export function main(argv: string[]): number {
  let args: Args
  try {
    args = parseArgs(argv)
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n\n${USAGE}`)
      return 1
    }
    throw error
  }
  if (args.help) {
    process.stdout.write(USAGE)
    return 0
  }

  const repoRoot = process.cwd()
  const ok = runOnce(repoRoot, args)

  if (!args.watch) return ok ? 0 : 1

  process.stdout.write(`watching ${TEMPLATES_DIR}/ for changes\n`)
  let timer: NodeJS.Timeout | undefined
  watch(path.join(repoRoot, TEMPLATES_DIR), { recursive: true }, (_event, filename) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      process.stdout.write(`\n${filename ? `${filename} changed` : 'change detected'}\n`)
      try {
        runOnce(repoRoot, args)
      } catch (error) {
        process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`)
      }
    }, 100)
  })
  return -1
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && /[\\/]cli\.(ts|js|mts|mjs)$/.test(process.argv[1])

if (invokedDirectly) {
  try {
    const code = main(process.argv.slice(2))
    if (code >= 0) process.exit(code)
  } catch (error) {
    process.stderr.write(`compiler bug: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`)
    process.exit(2)
  }
}
