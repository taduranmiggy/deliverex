/**
 * Generate tab/PWA favicon sizes from public/deliverexfavicon.png.
 * Crops to visible logo bounds (removes excess black canvas), then centers
 * the logo at ~87% of each square output.
 *
 * Usage: node scripts/generate-favicons.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import toIco from 'to-ico'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, '../public')
const source = path.join(publicDir, 'deliverexfavicon.png')

if (!fs.existsSync(source)) {
  console.error('Missing source:', source)
  process.exit(1)
}

const FILL_RATIO = 0.87

async function detectContentBounds(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0

  const isContent = (offset) => {
    const r = data[offset]
    const g = data[offset + 1]
    const b = data[offset + 2]
    const a = data[offset + 3]
    if (a < 16) return false
    return r + g + b > 60
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels
      if (!isContent(i)) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }

  if (maxX <= minX || maxY <= minY) {
    throw new Error('Could not detect logo bounds in source favicon')
  }

  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04)
  return {
    left: Math.max(0, minX - pad),
    top: Math.max(0, minY - pad),
    width: Math.min(width, maxX - minX + 1 + pad * 2),
    height: Math.min(height, maxY - minY + 1 + pad * 2),
  }
}

async function loadLogoBase() {
  const bounds = await detectContentBounds(source)
  const cropped = await sharp(source).extract(bounds).png().toBuffer()
  const side = Math.max(bounds.width, bounds.height)
  const offsetX = Math.round((side - bounds.width) / 2)
  const offsetY = Math.round((side - bounds.height) / 2)

  return sharp({
    create: {
      width: side,
      height: side,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: cropped, left: offsetX, top: offsetY }])
    .png()
    .toBuffer()
}

async function buildSquareIcon(logoBase, size) {
  const inner = Math.max(1, Math.round(size * FILL_RATIO))
  const resized = await sharp(logoBase)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()
}

const logoBase = await loadLogoBase()
const logoMeta = await sharp(logoBase).metadata()
console.log(`Logo crop (square): ${logoMeta.width}x${logoMeta.height}`)

const outputs = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-48x48.png', size: 48 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-192x192.png', size: 192 },
  { name: 'favicon-512x512.png', size: 512 },
]

const buffers = {}

for (const { name, size } of outputs) {
  const buf = await buildSquareIcon(logoBase, size)
  fs.writeFileSync(path.join(publicDir, name), buf)
  buffers[size] = buf
  console.log(`Wrote ${name} (${size}x${size}, ${buf.length} bytes)`)
}

const ico = await toIco([buffers[16], buffers[32], buffers[48]])
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico)
console.log(`Wrote favicon.ico (${ico.length} bytes)`)
