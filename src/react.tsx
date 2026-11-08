'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { pickCapture, type Bones, type Capture, type Theme } from './core.js'
import { snapshot, type SnapshotOptions } from './snapshot.js'

export type { Bone, Bones, Capture, Theme, Animate } from './core.js'
export type { SnapshotOptions } from './snapshot.js'
export { snapshot }

declare global {
  interface Window {
    __JIPLAK_BUILD?: boolean
    __JIPLAK_SNAPSHOT?: typeof snapshot
    /** Last shape of each skeleton seen during capture, kept after it unmounts. */
    __JIPLAK_SEEN?: Record<string, Capture>
  }
}

const isBuild = typeof window !== 'undefined' && window.__JIPLAK_BUILD === true
if (isBuild) window.__JIPLAK_SNAPSHOT = snapshot

const registry = new Map<string, Bones>()
let theme: Required<Theme> = {
  color: '#ececec',
  darkColor: '#262626',
  shimmerColor: '#f7f7f7',
  darkShimmerColor: '#323232',
  animate: 'pulse',
  speed: '1.6s',
}

/** Called by the generated registry; may also be called by hand. */
export function registerBones(map: Record<string, Bones>) {
  for (const [name, bones] of Object.entries(map)) registry.set(name, bones)
}

/** Global look defaults; jiplak.yaml values land here through the generated registry. */
export function configureJiplak(next: Theme) {
  theme = { ...theme, ...next }
}

const KEYFRAMES =
  '@keyframes jiplak-pulse{50%{opacity:.45}}' +
  '@keyframes jiplak-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}'

export interface SkeletonProps extends Theme {
  /** Key used by the CLI to capture and by the runtime to look up bones. */
  name: string
  loading: boolean
  children?: ReactNode
  /** Rendered instead of children while the CLI captures (mock data, no auth). */
  fixture?: ReactNode
  /** Bones passed directly instead of resolved from the registry. */
  bones?: Bones
  options?: SnapshotOptions
  className?: string
}

export function Skeleton({ name, loading, children, fixture, bones, options, className, ...look }: SkeletonProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (isBuild) {
      // A parent may hide this skeleton once data arrives (an empty list, a
      // finished step). Keep re-measuring so the CLI still gets its last shape.
      const save = () => {
        if (el.isConnected) (window.__JIPLAK_SEEN ??= {})[name] = snapshot(el, options)
      }
      save()
      const timer = setInterval(save, 250)
      return () => clearInterval(timer)
    }
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(el)
    const checkDark = () => setDark(!!el.closest('.dark'))
    checkDark()
    const mo = new MutationObserver(checkDark)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [])

  if (isBuild) {
    const marker = (
      <div
        ref={ref}
        className={className}
        data-jiplak={name}
        data-jiplak-options={options && JSON.stringify(options)}
        // Fixture links point at made-up records; the crawler must not follow them.
        data-jiplak-fixture={fixture ? '' : undefined}
      >
        {fixture ?? children}
      </div>
    )
    if (!fixture) return marker
    // The real children stay mounted but hidden, so the crawler still finds their links.
    return (
      <>
        {marker}
        <div hidden>{children}</div>
      </>
    )
  }

  const t = { ...theme, ...look }
  const source = bones ?? registry.get(name)
  const capture = loading && source && width > 0 ? pickCapture(source, width) : undefined
  const color = dark ? t.darkColor : t.color
  const highlight = dark ? t.darkShimmerColor : t.shimmerColor

  return (
    <div
      ref={ref}
      className={className}
      aria-busy={loading || undefined}
      style={{ position: 'relative', minHeight: capture?.height }}
    >
      <div style={capture ? { visibility: 'hidden' } : undefined}>{children}</div>
      {capture && (
        <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <style>{KEYFRAMES}</style>
          {capture.bones.map(([x, y, w, h, r, kind], i) => {
            const style: CSSProperties = {
              position: 'absolute',
              left: `${x}%`,
              top: y,
              // Circles keep their shape when the container is wider or narrower than at capture.
              width: r === '50%' ? h : `${w}%`,
              height: h,
              borderRadius: r,
            }
            // Cards and panels stay still and faint so the blocks on top read as content.
            if (kind === 1) return <div key={i} style={{ ...style, background: color, opacity: 0.45 }} />
            if (kind === 2) return <div key={i} style={{ ...style, border: `1px solid ${color}` }} />
            style.background = color
            if (t.animate === 'pulse') style.animation = `jiplak-pulse ${t.speed} ease-in-out infinite`
            if (t.animate === 'shimmer') {
              style.background = `linear-gradient(110deg, ${color} 30%, ${highlight} 50%, ${color} 70%)`
              style.backgroundSize = '200% 100%'
              style.animation = `jiplak-shimmer ${t.speed} linear infinite`
            }
            return <div key={i} style={style} />
          })}
        </div>
      )}
    </div>
  )
}
