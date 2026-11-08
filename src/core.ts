/** One placeholder rect: x and w are % of capture width, y and h are px, r is border-radius. */
export type Bone = [x: number, y: number, w: number, h: number, r: number | string]

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

/** Pick the capture for the largest breakpoint <= width, else the smallest one. */
export function pickCapture(bones: Bones, width: number): Capture | undefined {
  const bps = Object.keys(bones).map(Number).sort((a, b) => a - b)
  const bp = bps.filter(b => b <= width).pop() ?? bps[0]
  return bp === undefined ? undefined : bones[bp]
}
