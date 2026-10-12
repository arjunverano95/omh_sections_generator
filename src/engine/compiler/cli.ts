/**
 * `pnpm sections:compile [--template <name>] [--watch] [--check] [--all] [--strict]`
 * (compiler.md section 3). Exit 0 on success, 1 on template errors, 2 on a compiler bug.
 */

import { watch } from 'node:fs'
import path from 'node:path'

import { compile, DEFAULT_TEMPLATE, discoverTemplates, TEMPLATES_DIR, type CompileResult } from './index'
import { formatDiagnostic } from './errors'

type Args = {
  template?: string
  watch: boolean
  check: boolean
  all: boolean
  strict: boolean
  help: boolean
}

const USAGE = `Usage: pnpm sections:compile [options]

  --template <name>  compile templates/<name> (default: $SITE_TEMPLATE, else ${DEFAULT_TEMPLATE})
  --watch            recompile when a file under the template changes
  --check            validate and resolve only; write nothing, report schema.json drift
  --all              every template under templates/ (with --check)
  --strict           warnings fail the compile
  --help             this text
`

export function parseArgs(argv: string[]): Args {
  const args: Args = { watch: false, check: false, all: false, strict: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    const [flag, inline] = arg.includes('=') ? (arg.split(/=(.*)/s) as [string, string]) : [arg, undefined]
    switch (flag) {
      case '--template':
      case '-t': {
        const value = inline ?? argv[++i]
        if (!value) throw new UsageError('--template needs a name')
        args.template = value
        break
      }
      case '--watch':
        args.watch = true
        break
      case '--check':
        args.check = true
        break
      case '--all':
        args.all = true
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
  if (args.all && !args.check) throw new UsageError('--all compiles into one output folder; use it with --check')
  if (args.all && args.watch) throw new UsageError('--all and --watch do not combine')
  if (args.all && args.template) throw new UsageError('--all and --template do not combine')
  return args
}

class UsageError extends Error {}

function report(name: string, result: CompileResult, check: boolean): void {
  const out: string[] = []
  for (const d of result.diagnostics) out.push(formatDiagnostic(d), '')
  const errors = result.diagnostics.filter((d) => d.severity === 'error').length
  const warnings = result.diagnostics.length - errors
  const counts = [errors && `${errors} error${errors === 1 ? '' : 's'}`, warnings && `${warnings} warning${warnings === 1 ? '' : 's'}`]
    .filter(Boolean)
    .join(', ')
  if (!result.ok) {
    out.push(`${name}: failed (${counts})`)
  } else if (check) {
    out.push(`${name}: ok${counts ? ` (${counts})` : ''}`)
  } else {
    const t = result.template!
    const what = `${t.sections.length} section${t.sections.length === 1 ? '' : 's'} and 2 globals`
    const wrote = result.written.length ? `${result.written.length} file${result.written.length === 1 ? '' : 's'} written` : 'nothing changed'
    out.push(`${name}: ${what} compiled, ${wrote}${counts ? ` (${counts})` : ''}`)
  }
  process.stdout.write(`${out.join('\n')}\n`)
}

function runOnce(repoRoot: string, name: string, args: Args): boolean {
  const result = compile({
    repoRoot,
    templateDir: path.join(TEMPLATES_DIR, name),
    check: args.check,
    strict: args.strict,
  })
  report(name, result, args.check)
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

  if (args.all) {
    const names = discoverTemplates(repoRoot)
    if (names.length === 0) {
      process.stderr.write(`no templates found under ${TEMPLATES_DIR}/\n`)
      return 1
    }
    let ok = true
    for (const name of names) ok = runOnce(repoRoot, name, args) && ok
    return ok ? 0 : 1
  }

  const name = args.template ?? process.env.SITE_TEMPLATE ?? DEFAULT_TEMPLATE
  const ok = runOnce(repoRoot, name, args)

  if (!args.watch) return ok ? 0 : 1

  const dir = path.join(repoRoot, TEMPLATES_DIR, name)
  process.stdout.write(`watching ${TEMPLATES_DIR}/${name} for changes\n`)
  let timer: NodeJS.Timeout | undefined
  watch(dir, { recursive: true }, (_event, filename) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      process.stdout.write(`\n${filename ? `${filename} changed` : 'change detected'}\n`)
      try {
        runOnce(repoRoot, name, args)
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
