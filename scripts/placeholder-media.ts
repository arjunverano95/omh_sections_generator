/**
 * Writes small labelled placeholder JPEGs for template seed media.
 *
 *   pnpm exec tsx scripts/placeholder-media.ts <out.jpg> <width>x<height> "<label>" [from] [to]
 *
 * `from` and `to` are CSS colours. With one colour the image is solid; with two it is a
 * diagonal gradient. The label is centred in white; an empty label gives a plain gradient. Output is a progressive mozjpeg at a
 * quality that keeps a 1600x1200 image well under 60 KB.
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

type Options = {
  out: string
  width: number
  height: number
  label: string
  from: string
  to: string
}

const USAGE = 'usage: tsx scripts/placeholder-media.ts <out.jpg> <width>x<height> "<label>" [from] [to]'

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function parseArgs(argv: string[]): Options {
  const [out, size, label, from = '#334155', to] = argv
  const match = size?.match(/^(\d+)x(\d+)$/)
  if (!out || !match || label === undefined) throw new Error(USAGE)
  return {
    out,
    width: Number(match[1]),
    height: Number(match[2]),
    label,
    from,
    to: to ?? from,
  }
}

export function placeholderSvg({ width, height, label, from, to }: Omit<Options, 'out'>): string {
  // An image at least twice as wide as it is tall is a wordmark: the label fills its width.
  const wordmark = width >= height * 2 && label.length > 0
  const fontSize = Math.round(
    wordmark ? Math.min(height / 2.5, (width * 0.85) / (label.length * 0.6)) : Math.min(width, height) / 9,
  )
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${escapeXml(from)}"/>
      <stop offset="1" stop-color="${escapeXml(to)}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" fill-opacity="0.85"
    font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="600">${escapeXml(label)}</text>
</svg>`
}

export async function writePlaceholder(options: Options): Promise<number> {
  await mkdir(path.dirname(options.out), { recursive: true })
  const info = await sharp(Buffer.from(placeholderSvg(options)))
    .jpeg({ quality: 70, progressive: true, mozjpeg: true })
    .toFile(options.out)
  return info.size
}

const isMain = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2))
    const bytes = await writePlaceholder(options)
    console.log(`${options.out}: ${options.width}x${options.height}, ${(bytes / 1024).toFixed(1)} KB`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
