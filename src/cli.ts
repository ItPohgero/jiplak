#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'
import type { Bones, Capture } from './core.js'
import { crawlPaths, loadConfig, registrySource, routePlan, themeOf, validName } from './config.js'
import type { SnapshotOptions } from './snapshot.js'

const USAGE = `Usage:
  jiplak init                               create jiplak.yaml and an empty registry
  jiplak build [url] [--config jiplak.yaml] capture every <Skeleton> in your app

build starts at each route in jiplak.yaml, follows same-origin links, captures
every <Skeleton name="..."> at every breakpoint, and writes
<out>/<name>.bones.json plus <out>/registry.ts.`

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { config: { type: 'string', default: 'jiplak.yaml' }, help: { type: 'boolean', short: 'h' } },
})

if (values.help || !['build', 'init'].includes(positionals[0])) {
  console.log(USAGE)
  process.exit(values.help ? 0 : 1)
}

if (positionals[0] === 'init') {
  const outDir = existsSync('src') ? './src/bones' : './bones'
  if (existsSync(values.config!)) console.log(`jiplak: ${values.config} already exists, kept`)
  else {
    writeFileSync(values.config!, `# https://github.com/ItPohgero/jiplak#configuration\nurl: http://localhost:3000\nout: ${outDir}\n`)
    console.log(`jiplak: created ${values.config}`)
  }
  const registry = join(loadConfig(readFileSync(values.config!, 'utf8')).out, 'registry.ts')
  if (!existsSync(registry)) {
    mkdirSync(resolve(registry, '..'), { recursive: true })
    writeFileSync(registry, registrySource([], {}))
    console.log(`jiplak: created ${registry}`)
  }
  console.log(`\nNext:\n  1. import ${registry.replace(/\.ts$/, '')} once in a client component (relative path or your alias)\n  2. wrap components in <Skeleton name="..." loading={...}>\n  3. start your app, then run: npx jiplak build`)
  process.exit(0)
}

let configText = ''
try {
  configText = readFileSync(resolve(values.config!), 'utf8')
} catch {
  console.warn(`jiplak: ${values.config} not found, using defaults`)
}
const config = loadConfig(configText)
const origin = (positionals[1] ?? config.url).replace(/\/$/, '')
const out = resolve(config.out)

const browser = await chromium.launch({ channel: config.channel })
const context = await browser.newContext()
await context.addInitScript(() => {
  window.__JIPLAK_BUILD = true
})
// JIPLAK_COOKIES ("a=1; b=2", as copied from a Cookie header) keeps session cookies out of the repo.
const cookies = [...config.cookies, ...(process.env.JIPLAK_COOKIES ?? '').split(';').map(c => c.trim()).filter(c => c.includes('='))]
if (cookies.length > 0) {
  await context.addCookies(
    cookies.map(c => {
      const i = c.indexOf('=')
      return { name: c.slice(0, i), value: c.slice(i + 1), url: origin }
    }),
  )
}

const captured: Record<string, Bones> = {}
const page = await context.newPage()
const plan = routePlan(config.routes)
const queue = [...plan.starts]
const seen = new Set(queue)
const sampled = new Set<string>()
let dropped = 0
try {
  for (let route = queue.shift(); route !== undefined; route = queue.shift()) {
    for (const [i, width] of config.breakpoints.entries()) {
      await page.setViewportSize({ width, height: 900 })
      // A dev server may still be compiling: allow a slow load, then wait for the network to
      // settle, but never forever (pages that poll never go idle).
      const response = await page.goto(origin + route, { waitUntil: 'load', timeout: 90_000 }).catch(error => {
        console.warn(`  ${route}: ${error instanceof Error ? error.message.split('\n')[0] : error}, skipped`)
        return 'failed' as const
      })
      if (response === 'failed') break
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
      if (response && response.status() >= 500) {
        console.warn(`  ${route}: HTTP ${response.status()} from the server, skipped (is the app running?)`)
        break
      }
      // A page with <Skeleton> sets the hook once hydrated; give a slow hydration a few seconds.
      await page.waitForFunction(() => window.__JIPLAK_SNAPSHOT, null, { timeout: 5_000 }).catch(() => {})
      await page.waitForTimeout(config.wait)
      // Text width depends on the web font; measure only after it has loaded.
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      if (i === 0 && !page.url().startsWith(origin)) {
        console.warn(`  ${route}: redirected off-origin to ${page.url()}, skipped`)
        break
      }
      if (i === 0 && config.crawl) {
        const hrefs = await page.$$eval('a[href]', as =>
          as.filter(a => !a.closest('[data-jiplak-fixture]')).map(a => (a as HTMLAnchorElement).href),
        )
        for (const path of crawlPaths(hrefs, origin, config.ignore)) {
          if (seen.has(path) || !plan.allows(path)) continue
          const sample = plan.sampleOf(path)
          if (sample && sampled.has(sample)) continue
          if (seen.size >= config.maxPages) dropped++
          else {
            seen.add(path)
            queue.push(path)
            if (sample) sampled.add(sample)
          }
        }
      }
      const found = await page.evaluate(() => {
        const snap = window.__JIPLAK_SNAPSHOT
        if (!snap) return null
        // Live DOM wins; skeletons that already unmounted fall back to their last seen shape.
        const result: Record<string, Capture> = { ...window.__JIPLAK_SEEN }
        for (const el of document.querySelectorAll<HTMLElement>('[data-jiplak]')) {
          const opts: SnapshotOptions = el.dataset.jiplakOptions ? JSON.parse(el.dataset.jiplakOptions) : {}
          result[el.dataset.jiplak!] = snap(el, opts)
        }
        return result
      })
      if (!found) {
        continue // page does not load jiplak/react
      }
      for (const [name, capture] of Object.entries(found)) {
        if (!validName(name)) {
          console.warn(`  skip "${name}": use letters, digits, - or _`)
          continue
        }
        ;(captured[name] ??= {})[width] = capture
      }
      if (Object.keys(found).length > 0) console.log(`  ${route} @${width}: ${Object.keys(found).join(', ')}`)
    }
  }
} finally {
  await browser.close()
}

mkdirSync(out, { recursive: true })
for (const [name, bones] of Object.entries(captured)) {
  const file = join(out, `${name}.bones.json`)
  // Keep widths that failed this run instead of dropping them.
  const previous: Bones = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
  writeFileSync(file, JSON.stringify({ ...previous, ...bones }) + '\n')
  const missing = config.breakpoints.filter(w => !(w in bones))
  if (missing.length > 0) console.warn(`  ${name}: not captured at ${missing.join(', ')} this run, kept previous`)
}
// Skeletons not visited this run keep their previous bones.
const names = readdirSync(out)
  .filter(f => f.endsWith('.bones.json'))
  .map(f => f.slice(0, -'.bones.json'.length))
writeFileSync(join(out, 'registry.ts'), registrySource(names, themeOf(config)))
if (dropped > 0) console.warn(`jiplak: maxPages (${config.maxPages}) reached, ${dropped} linked page(s) not visited; raise maxPages if a skeleton is missing`)
if (Object.keys(captured).length === 0)
  console.warn('jiplak: no <Skeleton> found. Is the app running, and does a visited page import jiplak/react?')
console.log(`jiplak: ${seen.size} page(s) crawled, ${Object.keys(captured).length} skeleton(s) captured, ${names.length} in ${config.out}/registry.ts`)
