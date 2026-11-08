import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { type Browser, chromium, type Page } from 'playwright'
import type { Capture } from '../src/core'

// Runs the real capture code in a real browser. Uses installed Chrome, else Playwright's Chromium.
let browser: Browser | undefined
let page: Page

const CASES = `
<div style="font:16px/24px Arial, sans-serif; width:400px">
  <div id="para"><p style="margin:0;width:200px">Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod</p></div>
  <div id="clamp"><p style="margin:0;width:200px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden">Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore</p></div>
  <div id="clipped"><div style="width:64px;height:64px;border-radius:8px;overflow:hidden"><img style="display:block;width:64px;height:64px;background:#ccc"></div></div>
  <div id="circle"><img style="display:block;width:40px;height:40px;border-radius:9999px;background:#ccc"></div>
  <div id="divider"><div style="height:1px;background:#ddd"></div><div style="height:20px"></div></div>
  <div id="card"><div style="background:#eee;border-radius:12px;padding:8px"><span>Card</span></div></div>
  <div id="outline"><div style="border:1px solid #ddd;padding:8px"><span>Box</span></div></div>
  <div id="mixed"><a href="#">Title <svg width="16" height="16"></svg></a></div>
  <div id="split"><span>link by lokio · </span><span>Entitas</span></div>
  <div id="hidden"><span style="display:none">gone</span><span style="visibility:hidden">gone</span></div>
</div>`

beforeAll(async () => {
  browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  page = await browser.newPage()
  const built = await Bun.build({ entrypoints: [`${import.meta.dir}/../src/snapshot.ts`], format: 'esm' })
  await page.setContent(`<body style="margin:0">${CASES}</body>`)
  await page.addScriptTag({ type: 'module', content: `${await built.outputs[0].text()}\nwindow.__snap = { snapshot }` })
  await page.waitForFunction(() => (window as any).__snap)
})

afterAll(() => browser?.close())

const snap = (id: string): Promise<Capture> =>
  page.evaluate(i => (window as any).__snap.snapshot(document.getElementById(i)), id)

describe('snapshot', () => {
  test('each wrapped line of text is its own bar, sized to the glyphs', async () => {
    const { bones } = await snap('para')
    expect(bones.length).toBeGreaterThan(1)
    for (const [, , , h] of bones) expect(h).toBeLessThan(24) // glyph height, not line box
    for (const [x, , w] of bones) expect(x + w).toBeLessThanOrEqual(50.5) // 200px of 400px
  })

  test('line-clamped text keeps only the visible lines', async () => {
    expect((await snap('clamp')).bones).toHaveLength(2)
  })

  test('unrounded media takes the radius of the parent that clips it', async () => {
    expect((await snap('clipped')).bones).toEqual([[0, 0, 16, 64, '8px']])
  })

  test('square media with full radius is a circle', async () => {
    expect((await snap('circle')).bones[0][4]).toBe('50%')
  })

  test('empty painted box is a block, empty unpainted box is nothing', async () => {
    expect((await snap('divider')).bones).toEqual([[0, 0, 100, 1, 0]])
  })

  test('cards become surfaces behind their content', async () => {
    const { bones } = await snap('card')
    expect(bones[0]).toEqual([0, 0, 100, 40, '12px', 1])
    expect(bones).toHaveLength(2)
    expect((await snap('outline')).bones[0][5]).toBe(2)
  })

  test('text beside an icon is not lost', async () => {
    const { bones } = await snap('mixed')
    expect(bones).toHaveLength(2) // svg block + text bar
  })

  test('a label split across spans is one bar', async () => {
    expect((await snap('split')).bones).toHaveLength(1)
  })

  test('hidden elements are skipped', async () => {
    expect((await snap('hidden')).bones).toHaveLength(0)
  })
})
