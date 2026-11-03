// Generates the site's Lottie animations (public/lottie/*.json) from code,
// so they stay small, on-brand and editable. Run: npm run lottie
//
// Lottie basics used here: a composition (fr frames/s, ip..op frames) of
// shape layers (ty 4); a layer has transform `ks` (o opacity, r rotation,
// p position, a anchor, s scale) and `shapes`: groups (gr) of an ellipse (el),
// a stroke (st), a fill (fl) and the group's transform (tr). Animated
// properties are `{ a: 1, k: [keyframes] }` with eased keyframes.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/lottie')
fs.mkdirSync(out, { recursive: true })

const ease = { i: { x: [0.2], y: [1] }, o: { x: [0.4], y: [0] } }
const linear = { i: { x: [1], y: [1] }, o: { x: [0], y: [0] } }
const stat = v => ({ a: 0, k: v })
/** Keyframes: [[frame, value], …] with the same easing between each pair. */
const anim = (pairs, e = ease) => ({
  a: 1,
  k: pairs.map(([t, s], i) => (i === pairs.length - 1 ? { t, s } : { t, s, ...e })),
})
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)

function ellipse(size) {
  return { ty: 'el', p: stat([0, 0]), s: stat([size, size]), d: 1 }
}
function stroke(color, width, opacity = stat(100)) {
  return { ty: 'st', c: stat([...rgb(color), 1]), o: opacity, w: stat(width), lc: 2, lj: 2 }
}
function fill(color, opacity = stat(100)) {
  return { ty: 'fl', c: stat([...rgb(color), 1]), o: opacity, r: 1 }
}
function tr(extra = {}) {
  return { ty: 'tr', p: stat([0, 0]), a: stat([0, 0]), s: stat([100, 100]), r: stat(0), o: stat(100), sk: stat(0), sa: stat(0), ...extra }
}
function group(items, name) {
  return { ty: 'gr', nm: name, it: items }
}
function layer(name, shapes, ks = {}, { ip = 0, op, w, h } = {}) {
  return {
    ddd: 0,
    ty: 4,
    nm: name,
    sr: 1,
    ks: { o: stat(100), r: stat(0), p: stat([w / 2, h / 2, 0]), a: stat([0, 0, 0]), s: stat([100, 100, 100]), ...ks },
    ao: 0,
    shapes,
    ip,
    op,
    st: 0,
    bm: 0,
  }
}
function comp(name, { w, h, fr = 60, op, layers }) {
  return { v: '5.12.2', fr, ip: 0, op, w, h, nm: name, ddd: 0, assets: [], layers, markers: [] }
}

/* ---- tap: a fingertip pressing, with two ripples. Loops every 1.6 s. ---- */
{
  const w = 160, h = 160, op = 96
  const accent = '#4d7cff'
  const ripple = (delay, name) =>
    layer(
      name,
      [
        group(
          [
            ellipse(40),
            stroke(accent, 3, anim([[delay, 90], [delay + 54, 0]], linear)),
            tr({ s: anim([[delay, [60, 60]], [delay + 54, [240, 240]]]) }),
          ],
          name,
        ),
      ],
      { o: stat(100) },
      { ip: delay, op: delay + 54, w, h },
    )
  const dot = layer(
    'dot',
    [
      group(
        [ellipse(26), fill(accent, stat(100)), stroke('#ffffff', 2.5), tr({ s: anim([[0, [100, 100]], [10, [78, 78]], [22, [100, 100]], [96, [100, 100]]]) })],
        'dot',
      ),
    ],
    {},
    { op, w, h },
  )
  const halo = layer('halo', [group([ellipse(44), fill(accent, anim([[0, 22], [10, 40], [22, 22], [96, 22]], linear)), tr()], 'halo')], {}, { op, w, h })
  fs.writeFileSync(path.join(out, 'tap.json'), JSON.stringify(comp('tap', { w, h, op, layers: [ripple(6, 'ripple-1'), ripple(30, 'ripple-2'), halo, dot] })))
}

/* ---- pulse: a sonar for the hero's phone node (3 rings, 2.4 s loop). ---- */
{
  const w = 120, h = 120, op = 144
  const accent = '#22d3ee'
  const ring = (delay, name) =>
    layer(
      name,
      [group([ellipse(30), stroke(accent, 2, anim([[delay, 80], [delay + 90, 0]], linear)), tr({ s: anim([[delay, [40, 40]], [delay + 90, [340, 340]]], linear) })], name)],
      {},
      { ip: delay, op: delay + 90, w, h },
    )
  const core = layer('core', [group([ellipse(14), fill(accent), tr({ s: anim([[0, [100, 100]], [72, [120, 120]], [144, [100, 100]]]) })], 'core')], {}, { op, w, h })
  fs.writeFileSync(path.join(out, 'pulse.json'), JSON.stringify(comp('pulse', { w, h, op, layers: [ring(0, 'r1'), ring(48, 'r2'), ring(96, 'r3'), core] })))
}

/* ---- check: a ring that closes and a tick that draws (plays once, 0.9 s). ---- */
{
  const w = 120, h = 120, op = 54
  const green = '#34d399'
  const ring = layer(
    'ring',
    [
      group(
        [
          ellipse(80),
          { ty: 'tm', s: stat(0), e: anim([[0, 0], [30, 100]]), o: stat(-90), m: 1 },
          stroke(green, 6),
          tr(),
        ],
        'ring',
      ),
    ],
    {},
    { op, w, h },
  )
  const tick = layer(
    'tick',
    [
      group(
        [
          { ty: 'sh', ks: stat({ c: false, v: [[-20, 2], [-6, 16], [22, -14]], i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]] }) },
          { ty: 'tm', s: stat(0), e: anim([[22, 0], [44, 100]]), o: stat(0), m: 1 },
          stroke(green, 7),
          tr(),
        ],
        'tick',
      ),
    ],
    {},
    { op, w, h },
  )
  const glow = layer('glow', [group([ellipse(96), fill(green, anim([[24, 0], [38, 28], [54, 14]], linear)), tr()], 'glow')], {}, { op, w, h })
  fs.writeFileSync(path.join(out, 'check.json'), JSON.stringify(comp('check', { w, h, op, layers: [tick, ring, glow] })))
}

/* ---- orbit: three dots chasing each other (tool call running, 1 s loop). ---- */
{
  const w = 64, h = 64, op = 60
  const colors = ['#7d97ff', '#22d3ee', '#a78bfa']
  const dots = colors.map((c, i) =>
    layer(
      `dot-${i}`,
      [group([ellipse(12), fill(c), tr({ p: stat([0, -18]) })], `dot-${i}`)],
      { r: anim([[0, i * 120], [60, i * 120 + 360]], linear) },
      { op, w, h },
    ),
  )
  fs.writeFileSync(path.join(out, 'orbit.json'), JSON.stringify(comp('orbit', { w, h, op, layers: dots })))
}

console.log('lottie: tap.json pulse.json check.json orbit.json →', out)
