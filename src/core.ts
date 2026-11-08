/**
 * How a bone is drawn. Omitted for a placeholder block (so 0.1 bones stay valid);
 * 1 = card/panel surface with a background, 2 = surface with only a border.
 */
export type Kind = 1 | 2

/** One rect: x and w are % of capture width, y and h are px, r is border-radius. */
export type Bone = [x: number, y: number, w: number, h: number, r: number | string, kind?: Kind]

/** Layout of one `<Skeleton>` captured at one viewport width. */
export interface Capture {
  width: number
  height: number
  bones: Bone[]
}

/** Captures keyed by viewport width, as written to `<name>.bones.json`. */
export type Bones = Record<string, Capture>

export type Animate = 'pulse' | 'shimmer' | 'solid'

/** Runtime look, shared by jiplak.yaml and `configureJiplak`. */
export interface Theme {
  color?: string
  darkColor?: string
  shimmerColor?: string
  darkShimmerColor?: string
  animate?: Animate
  speed?: string
}

/**
 * Pick the capture whose captured container width is nearest to `width`.
 * Compares container to container (keys are viewport widths, and a container is
 * usually narrower than its viewport). Nearest, not floor, so a scrollbar that
 * shaves a few px off the live container still picks the matching capture.
 */
export function pickCapture(bones: Bones, width: number): Capture | undefined {
  let best: Capture | undefined
  for (const c of Object.values(bones)) {
    if (!best || Math.abs(c.width - width) < Math.abs(best.width - width)) best = c
  }
  return best
}
