#!/usr/bin/env node
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'
import type { Bones, Capture } from './core.js'
import { crawlPaths, loadConfig, registrySource, themeOf, validName } from './config.js'
import type { SnapshotOptions } from './snapshot.js'

const USAGE = `Usage: jiplak build [url] [--config jiplak.yaml]

Starts at each route in jiplak.yaml, follows same-origin links, captures
every <Skeleton name="..."> at every breakpoint, and writes
<out>/<name>.bones.json plus <out>/registry.ts.`

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { config: { type: 'string', default: 'jiplak.yaml' }, help: { type: 'boolean', short: 'h' } },
})

if (values.help || positionals[0] !== 'build') {
  console.log(USAGE)
  process.exit(values.help ? 0 : 1)
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
if (config.cookies.length > 0) {
  await context.addCookies(
    config.cookies.map(c => {
      const i = c.indexOf('=')
      return { name: c.slice(0, i), value: c.slice(i + 1), url: origin }
    }),
  )
}

const captured: Record<string, Bones> = {}
const page = await context.newPage()
const queue = [...new Set(config.routes)]
const seen = new Set(queue)
try {
  for (let route = queue.shift(); route !== undefined; route = queue.shift()) {
    for (const [i, width] of config.breakpoints.entries()) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(origin + route, { waitUntil: 'load' })
      await page.waitForTimeout(config.wait)
      if (i === 0) {
        if (!page.url().startsWith(origin)) {
          console.warn(`  ${route}: redirected off-origin to ${page.url()}, skipped`)
          break
        }
        const hrefs = await page.$$eval('a[href]', as => as.map(a => (a as HTMLAnchorElement).href))
        for (const path of crawlPaths(hrefs, origin, config.ignore)) {
          if (seen.size >= config.maxPages) break
          if (!seen.has(path)) {
            seen.add(path)
            queue.push(path)
          }
        }
      }
      const found = await page.evaluate(() => {
        const snap = window.__JIPLAK_SNAPSHOT
        if (!snap) return null
        const result: Record<string, Capture> = {}
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
  writeFileSync(join(out, `${name}.bones.json`), JSON.stringify(bones) + '\n')
}
// Skeletons not visited this run keep their previous bones.
const names = readdirSync(out)
  .filter(f => f.endsWith('.bones.json'))
  .map(f => f.slice(0, -'.bones.json'.length))
writeFileSync(join(out, 'registry.ts'), registrySource(names, themeOf(config)))
if (seen.size >= config.maxPages) console.warn(`jiplak: stopped at maxPages (${config.maxPages}); raise it in jiplak.yaml if pages were missed`)
console.log(`jiplak: ${seen.size} page(s) crawled, ${Object.keys(captured).length} skeleton(s) captured, ${names.length} in ${config.out}/registry.ts`)
