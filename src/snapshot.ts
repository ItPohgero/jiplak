import type { Bone, Capture, Kind } from './core.js'

/** Per-skeleton capture tuning, passed as `<Skeleton options>`. */
export interface SnapshotOptions {
  /** Tags captured as one solid block instead of being walked (e.g. a chart wrapper). */
  leafTags?: string[]
  /** CSS selectors skipped together with their descendants. */
  exclude?: string[]
}

interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/** Replaced or interactive elements whose whole box is the placeholder. */
const ATOMIC = new Set([
  'img', 'svg', 'video', 'canvas', 'picture', 'iframe', 'object',
  'input', 'button', 'textarea', 'select', 'progress', 'meter',
])
const TEXT_RADIUS = 4
const NO_CLIP: Box = { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity }

const clear = (color: string) => color === 'transparent' || /^rgba\(.*,\s*0\)$/.test(color)

function intersect(a: Box, b: Box): Box | null {
  const box = {
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  }
  return box.right - box.left >= 1 && box.bottom - box.top >= 1 ? box : null
}

/** Radius as the eye sees it: an unrounded child takes the radius of the same-size parent that clips it. */
function radius(el: Element, root: Element): number | string {
  const rect = el.getBoundingClientRect()
  let style = getComputedStyle(el)
  let node = el
  while (parseFloat(style.borderTopLeftRadius) === 0 && node.parentElement && node.parentElement !== root) {
    const parent = node.parentElement
    const pr = parent.getBoundingClientRect()
    const ps = getComputedStyle(parent)
    if (ps.overflow === 'visible' || Math.abs(pr.width - rect.width) > 2 || Math.abs(pr.height - rect.height) > 2) break
    node = parent
    style = ps
  }
  const r = parseFloat(style.borderTopLeftRadius) || 0
  if (r === 0) return 0
  const square = Math.abs(rect.width - rect.height) < 2
  if (style.borderRadius.includes('%') || r >= Math.min(rect.width, rect.height) / 2) return square ? '50%' : 9999
  return style.borderRadius
}

/** Background colour the element sits on, so wrappers painted the same colour are not treated as cards. */
function backdrop(el: Element): string {
  for (let node: Element | null = el; node; node = node.parentElement) {
    const bg = getComputedStyle(node).backgroundColor
    if (!clear(bg)) return bg
  }
  return 'rgb(255, 255, 255)'
}

/** Join text fragments on one line (a label split across spans) into one bar. */
function mergeLines(lines: Box[]): Box[] {
  const sorted = [...lines].sort((a, b) => a.top - b.top || a.left - b.left)
  const out: Box[] = []
  for (const box of sorted) {
    const last = out[out.length - 1]
    const sameLine = last && Math.abs(last.top - box.top) <= 2 && Math.abs(last.bottom - box.bottom) <= 3
    if (sameLine && box.left - last.right <= 8) {
      last.right = Math.max(last.right, box.right)
      last.top = Math.min(last.top, box.top)
      last.bottom = Math.max(last.bottom, box.bottom)
    } else out.push({ ...box })
  }
  return out
}

/**
 * Record the visible shape of everything inside `root`: every line of text as
 * its own bar (measured from the glyphs, not the element box), media and form
 * controls as blocks, and cards/panels as surfaces drawn behind them.
 */
export function snapshot(root: Element, options: SnapshotOptions = {}): Capture {
  const base = root.getBoundingClientRect()
  const leafTags = new Set(options.leafTags ?? [])
  const exclude = options.exclude?.join(',')
  const surfaces: Bone[] = []
  const blocks: Bone[] = []
  const lines: Box[] = []

  const bone = (box: Box, r: number | string, kind?: Kind): Bone => {
    const b: Bone = [
      base.width > 0 ? +(((box.left - base.left) / base.width) * 100).toFixed(3) : 0,
      Math.round(box.top - base.top),
      base.width > 0 ? +(((box.right - box.left) / base.width) * 100).toFixed(3) : 0,
      Math.round(box.bottom - box.top),
      r,
    ]
    if (kind) b.push(kind)
    return b
  }

  const text = (node: Text, clip: Box) => {
    if (!node.textContent?.trim()) return
    const range = document.createRange()
    range.selectNodeContents(node)
    for (const rect of range.getClientRects()) {
      const box = intersect(rect, clip)
      if (box) lines.push(box)
    }
  }

  const walk = (el: Element, clip: Box, bg: string) => {
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return
    if (exclude && el.matches(exclude)) return
    const tag = el.tagName.toLowerCase()
    const box = intersect(el.getBoundingClientRect(), clip)
    if (ATOMIC.has(tag) || leafTags.has(tag)) {
      if (box) blocks.push(bone(box, radius(el, root)))
      return
    }
    const ownBg = style.backgroundColor
    const filled = (!clear(ownBg) && ownBg !== bg) || style.backgroundImage !== 'none'
    const sides = (['top', 'right', 'bottom', 'left'] as const).filter(side => {
      const width = parseFloat(style.getPropertyValue(`border-${side}-width`))
      return width > 0 && !clear(style.getPropertyValue(`border-${side}-color`))
    })
    const outlined = sides.length === 4
    const hasContent = [...el.childNodes].some(n => n.nodeType === 1 || (n.nodeType === 3 && n.textContent?.trim()))
    if (box && !filled && !outlined) {
      // A border on some sides only (a row divider) is drawn as those lines, not as a box.
      for (const side of sides) {
        const w = parseFloat(style.getPropertyValue(`border-${side}-width`))
        const line = intersect(
          {
            left: side === 'right' ? box.right - w : box.left,
            top: side === 'bottom' ? box.bottom - w : box.top,
            right: side === 'left' ? box.left + w : box.right,
            bottom: side === 'top' ? box.top + w : box.bottom,
          },
          clip,
        )
        if (line) surfaces.push(bone(line, 0, 1))
      }
    }
    if (!hasContent) {
      // An empty painted box is visible content on its own: a dot, a swatch, a cover image.
      if (box && (filled || outlined)) blocks.push(bone(box, radius(el, root)))
      return
    }
    if (box && (filled || outlined)) surfaces.push(bone(box, radius(el, root), filled ? 1 : 2))
    const inner = style.overflow !== 'visible' ? (intersect(clip, el.getBoundingClientRect()) ?? clip) : clip
    const innerBg = clear(ownBg) ? bg : ownBg
    for (const node of el.childNodes) {
      if (node.nodeType === 3) text(node as Text, inner)
      else if (node.nodeType === 1) walk(node as Element, inner, innerBg)
    }
  }

  const bg = backdrop(root)
  for (const node of root.childNodes) {
    if (node.nodeType === 3) text(node as Text, NO_CLIP)
    else if (node.nodeType === 1) walk(node as Element, NO_CLIP, bg)
  }
  const textBones = mergeLines(lines).map(box => bone(box, TEXT_RADIUS))
  return {
    width: Math.round(base.width),
    height: Math.round(base.height),
    bones: [...surfaces, ...blocks, ...textBones],
  }
}
