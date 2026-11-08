import type { Bone, Capture } from './core.js'

/** Per-skeleton capture tuning, passed as `<Skeleton options>`. */
export interface SnapshotOptions {
  /** Extra tags captured as one bone while they hold only inline content. */
  leafTags?: string[]
  /** CSS selectors skipped together with their descendants. */
  exclude?: string[]
}

const LEAF_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th', 'label']
const ATOMIC = new Set(['img', 'svg', 'video', 'canvas', 'picture', 'input', 'button', 'textarea', 'select'])

const pct = (v: number, total: number) => (total > 0 ? +((v / total) * 100).toFixed(3) : 0)

function visible(el: Element) {
  const s = getComputedStyle(el)
  return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0'
}

function radius(el: Element, rect: DOMRect, tag: string): number | string {
  const square = Math.abs(rect.width - rect.height) < 4
  const s = getComputedStyle(el)
  const r = parseFloat(s.borderTopLeftRadius) || 0
  if (r === 0) return square && ATOMIC.has(tag) && tag !== 'input' && tag !== 'button' ? '50%' : 6
  if (s.borderRadius.includes('%') || r >= Math.min(rect.width, rect.height) / 2) return square ? '50%' : 9999
  return s.borderRadius
}

/**
 * Walk the rendered children of `root` and record every visible leaf
 * (text block, media, form control, childless element) as a bone.
 */
export function snapshot(root: Element, options: SnapshotOptions = {}): Capture {
  const base = root.getBoundingClientRect()
  const leafTags = new Set([...LEAF_TAGS, ...(options.leafTags ?? [])])
  const exclude = options.exclude?.join(',')
  const bones: Bone[] = []

  const walk = (el: Element) => {
    if (!visible(el) || (exclude && el.matches(exclude))) return
    const tag = el.tagName.toLowerCase()
    const kids = [...el.children].filter(visible)
    const inlineOnly = kids.every(k => ['inline', 'contents'].includes(getComputedStyle(k).display))
    if (kids.length > 0 && !ATOMIC.has(tag) && !(leafTags.has(tag) && inlineOnly)) {
      kids.forEach(walk)
      return
    }
    const rect = el.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return
    bones.push([
      pct(rect.left - base.left, base.width),
      Math.round(rect.top - base.top),
      pct(rect.width, base.width),
      Math.round(rect.height),
      radius(el, rect, tag),
    ])
  }

  ;[...root.children].forEach(walk)
  return { width: Math.round(base.width), height: Math.round(base.height), bones }
}
