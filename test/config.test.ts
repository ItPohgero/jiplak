import { describe, expect, test } from 'bun:test'
import { pickCapture } from '../src/core'
import { crawlPaths, loadConfig, registrySource, routePlan, themeOf, validName } from '../src/config'

describe('loadConfig', () => {
  test('empty file gives defaults', () => {
    const c = loadConfig('')
    expect(c.url).toBe('http://localhost:3000')
    expect(c.routes).toEqual(['/'])
    expect(c.breakpoints).toEqual([375, 768, 1280])
  })

  test('reads yaml values', () => {
    const c = loadConfig(`
url: http://localhost:5173
routes: [/, /dashboard]
breakpoints: [390, 1440]
out: ./app/bones
animate: shimmer
color: "#e5e5e5"
channel: chrome
`)
    expect(c.routes).toEqual(['/', '/dashboard'])
    expect(c.breakpoints).toEqual([390, 1440])
    expect(c.channel).toBe('chrome')
    expect(themeOf(c)).toEqual({ color: '#e5e5e5', animate: 'shimmer' })
  })

  test.each([
    ['colour: red', 'unknown key "colour"'],
    ['url: localhost:3000', 'url must start'],
    ['routes: [dashboard]', 'must start with "/"'],
    ['breakpoints: [0]', 'positive integers'],
    ['animate: wobble', 'animate must be one of'],
    ['cookies: [session]', 'name=value'],
    ['- a', 'root must be a mapping'],
  ])('rejects %p', (yaml, msg) => {
    expect(() => loadConfig(yaml)).toThrow(msg)
  })
})

test('pickCapture picks nearest container width, not viewport key', () => {
  const cap = (width: number) => ({ width, height: width, bones: [] })
  // Viewport 1280 gave a 704px container; 768 gave 584; 375 gave 335.
  const bones = { 375: cap(335), 768: cap(584), 1280: cap(704) }
  expect(pickCapture(bones, 704)?.width).toBe(704)
  expect(pickCapture(bones, 689)?.width).toBe(704) // live scrollbar takes 15px
  expect(pickCapture(bones, 600)?.width).toBe(584)
  expect(pickCapture(bones, 320)?.width).toBe(335)
  expect(pickCapture({}, 800)).toBeUndefined()
})

test('registrySource imports every bones file sorted', () => {
  const src = registrySource(['user-card', 'blog-card'], { animate: 'pulse' })
  expect(src).toContain("import b0 from './blog-card.bones.json'")
  expect(src).toContain('"user-card": b1 as unknown as Bones,')
  expect(src).toContain('configureJiplak({"animate":"pulse"})')
})

test('validName blocks path tricks', () => {
  expect(validName('blog-card_2')).toBe(true)
  expect(validName('../x')).toBe(false)
  expect(validName('')).toBe(false)
})

test('crawlPaths keeps same-origin pages, drops logout, files, ignored and external', () => {
  const origin = 'http://localhost:3000'
  const paths = crawlPaths(
    [
      'http://localhost:3000/dashboard?tab=1#top',
      'http://localhost:3000/dashboard/',
      '/event/12',
      'http://localhost:3000/logout',
      'http://localhost:3000/auth/sign-out',
      'http://localhost:3000/files/report.pdf',
      'http://localhost:3000/admin/users',
      'https://google.com/',
      'mailto:a@b.c',
    ],
    origin,
    ['/admin'],
  )
  expect(paths).toEqual(['/dashboard', '/event/12'])
})

test('loadConfig validates crawl keys', () => {
  expect(loadConfig('').maxPages).toBe(50)
  expect(() => loadConfig('maxPages: 0')).toThrow('maxPages')
  expect(() => loadConfig('ignore: [admin]')).toThrow('ignore')
})

describe('routePlan', () => {
  const plan = routePlan(['/id', '/id/learn/**', '/id/entities/*', '/id/learn/class/show/*'])

  test('plain paths and glob prefixes are start points', () => {
    // /id/learn/class/show is reached by crawling /id/learn/**, so it is not a start.
    expect(plan.starts).toEqual(['/id', '/id/learn', '/id/entities'])
  })

  test('only links matching a glob are followed', () => {
    expect(plan.allows('/id/learn/calendar')).toBe(true)
    expect(plan.allows('/id/learn')).toBe(true)
    expect(plan.allows('/id/entities/supr-space')).toBe(true)
    expect(plan.allows('/id/entities/supr-space/members')).toBe(false) // * is one segment
    expect(plan.allows('/id/governance')).toBe(false)
  })

  test('* globs are sampled once; ** globs are not', () => {
    expect(plan.sampleOf('/id/entities/a')).toBe('/id/entities/*')
    expect(plan.sampleOf('/id/learn/class/show/42')).toBe('/id/learn/class/show/*')
    expect(plan.sampleOf('/id/learn/calendar')).toBeUndefined()
  })

  test('without globs every link is followed', () => {
    const open = routePlan(['/'])
    expect(open.starts).toEqual(['/'])
    expect(open.allows('/anything/deep')).toBe(true)
    expect(open.sampleOf('/anything')).toBeUndefined()
  })

  test('a glob at the root starts at /', () => {
    expect(routePlan(['/*']).starts).toEqual(['/'])
  })
})
