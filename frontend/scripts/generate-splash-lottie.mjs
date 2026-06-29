/**
 * Build deliverex-splash.json — cinematic logo reveal for PWA splash.
 * Embeds favicon-512x512.png as a Lottie image asset.
 *
 * Usage: node scripts/generate-splash-lottie.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, '../public')
const faviconPath = path.join(publicDir, 'favicon-512x512.png')
const outDir = path.join(publicDir, 'lottie')
const outPath = path.join(outDir, 'deliverex-splash.json')

if (!fs.existsSync(faviconPath)) {
  console.error('Missing favicon. Run: npm run generate-favicons')
  process.exit(1)
}

const b64 = fs.readFileSync(faviconPath).toString('base64')
const dataUri = `data:image/png;base64,${b64}`
const USE_EMBEDDED_IMAGE = process.env.LOTTIE_EMBED === '1'

const W = 512
const H = 512
const FPS = 60
const DURATION_FRAMES = 90 // 1.5s

/** Eased keyframes helper */
function kf(times, values) {
  return times.map((t, i) => ({
    t: Math.round(t * DURATION_FRAMES),
    s: Array.isArray(values[i]) ? values[i] : [values[i]],
    i: { x: [0.22, 0.22], y: [1, 1] },
    o: { x: [0.36, 0.36], y: [0, 0] },
  }))
}

const animation = {
  v: '5.7.4',
  fr: FPS,
  ip: 0,
  op: DURATION_FRAMES,
  w: W,
  h: H,
  nm: 'Deliverex Splash',
  ddd: 0,
  assets: [
    {
      id: 'image_0',
      w: 512,
      h: 512,
      u: USE_EMBEDDED_IMAGE ? '' : '/',
      p: USE_EMBEDDED_IMAGE ? dataUri : 'favicon-512x512.png?v=2',
      e: USE_EMBEDDED_IMAGE ? 1 : 0,
    },
  ],
  layers: [
    // Soft radial glow behind logo
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Glow',
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: kf([0, 0.15, 0.5, 1], [0, 40, 28, 0]),
        },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [W / 2, H / 2, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: kf([0, 0.2, 0.55, 1], [[60, 60, 100], [130, 130, 100], [150, 150, 100], [170, 170, 100]]),
        },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              ty: 'el',
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [280, 280] },
            },
            {
              ty: 'fl',
              c: { a: 0, k: [0.114, 0.227, 0.929, 1] }, // #1d4ed8
              o: { a: 0, k: 100 },
              r: 1,
            },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: 'Glow Circle',
        },
      ],
      ip: 0,
      op: DURATION_FRAMES,
      st: 0,
      bm: 0,
    },
    // Logo image reveal
    {
      ddd: 0,
      ind: 2,
      ty: 2,
      nm: 'Logo',
      refId: 'image_0',
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: kf([0, 0.12, 0.35, 1], [0, 100, 100, 100]),
        },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [W / 2, H / 2, 0] },
        a: { a: 0, k: [256, 256, 0] },
        s: {
          a: 1,
          k: kf([0, 0.18, 0.45, 1], [[55, 55, 100], [108, 108, 100], [100, 100, 100], [100, 100, 100]]),
        },
      },
      ao: 0,
      ip: 0,
      op: DURATION_FRAMES,
      st: 0,
      bm: 0,
    },
    // Shine sweep (subtle white arc)
    {
      ddd: 0,
      ind: 3,
      ty: 4,
      nm: 'Shine',
      sr: 1,
      ks: {
        o: {
          a: 1,
          k: kf([0, 0.35, 0.55, 0.75, 1], [0, 0, 35, 20, 0]),
        },
        r: { a: 0, k: -25 },
        p: {
          a: 1,
          k: kf([0, 0.35, 0.75, 1], [[180, H / 2, 0], [W / 2, H / 2, 0], [340, H / 2, 0], [400, H / 2, 0]]),
        },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            {
              ty: 'rc',
              p: { a: 0, k: [0, 0] },
              s: { a: 0, k: [24, 200] },
              r: { a: 0, k: 12 },
            },
            {
              ty: 'fl',
              c: { a: 0, k: [1, 1, 1, 1] },
              o: { a: 0, k: 100 },
              r: 1,
            },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: 'Shine Bar',
        },
      ],
      ip: 0,
      op: DURATION_FRAMES,
      st: 0,
      bm: 0,
    },
  ],
}

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(animation))

const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1)
console.log(`Wrote ${outPath} (${sizeKb} KB)`)

if (fs.statSync(outPath).size > 120 * 1024) {
  console.warn('Warning: Lottie file exceeds 120KB target — consider external image reference')
}
