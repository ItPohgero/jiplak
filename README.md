<div align="center">

# jiplak

**Pixel-perfect skeleton loading screens, auto-captured from your real React UI.**

Wrap a component. Run one command. Get a skeleton that matches it exactly.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![React](https://img.shields.io/badge/React-%E2%89%A518-149eca?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Sponsored by Lokio](https://img.shields.io/badge/sponsored%20by-Lokio-FF7A57)](https://lokio.link)

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/wahyuagusarifin)

English · [Bahasa Indonesia](./README.id.md)

</div>

---

## Why jiplak?

Hand-drawn skeletons drift out of sync with the real UI the moment a layout
changes. jiplak ("to trace" in Indonesian) traces your rendered components in
a real browser and stores their exact shape. You never draw a skeleton again.

- **Zero drawing.** Bones come from the real DOM: text, images, buttons.
- **Zero route list.** The CLI crawls your app through its own links.
- **Responsive.** Captured at several screen widths; the right one is picked at runtime.
- **One YAML file.** `jiplak.yaml`, one line to start.
- **Dark mode.** Follows the `.dark` class (Tailwind convention).
- **Tiny runtime.** One React component; the capture tooling never ships to the browser.

## Contents

- [Quick start](#quick-start)
- [FAQ](#faq)
- [Configuration](#configuration)
- [API](#api)
- [How it works](#how-it-works)
- [Sponsor](#sponsor)
- [Author](#author)
- [License](#license)

## Quick start

### 1. Install

```bash
npm install jiplak
# or
bun add jiplak
```

### 2. Wrap components that wait for data

```tsx
import { Skeleton } from 'jiplak/react'

function Profile() {
  const { data, isLoading } = useProfile()

  return (
    <Skeleton name="profile-card" loading={isLoading}>
      <ProfileCard user={data} />
    </Skeleton>
  )
}
```

### 3. Add `jiplak.yaml` to your project root

```yaml
url: http://localhost:3000
```

### 4. Start your app, then capture

```bash
npm run dev
```

In a second terminal:

```bash
npx jiplak build
```

### 5. Import the generated registry once

Import it from a client component that always loads, such as your providers:

```tsx
'use client'
import './bones/registry'
```

Done. While `loading` is `true`, the skeleton shows automatically.

## FAQ

<details>
<summary><b>Do I wrap every screen?</b></summary>

No. Wrap only the parts that wait for data, such as cards, lists, or tables.
Static parts like headers and menus need nothing. One screen can hold several
`<Skeleton>` components with different names.

</details>

<details>
<summary><b>Is the skeleton really generated automatically?</b></summary>

Yes. `jiplak build` crawls your app through its links, finds every
`<Skeleton>`, and records its shape. Your only job is to wrap components.

</details>

<details>
<summary><b>When do I run <code>jiplak build</code> again?</b></summary>

After a wrapped component changes its layout, or after you add a new
`<Skeleton>`. Commit the `src/bones/` folder so your team does not need to
rebuild.

</details>

<details>
<summary><b>What happens before the first build?</b></summary>

Your app works as usual. Components render normally, just without a
skeleton.

</details>

<details>
<summary><b>My component is empty without data.</b></summary>

Pass sample content through `fixture`. jiplak captures the fixture instead of
the real children:

```tsx
<Skeleton name="profile-card" loading={isLoading} fixture={<ProfileCard user={sampleUser} />}>
  <ProfileCard user={data} />
</Skeleton>
```

</details>

<details>
<summary><b>A page was not found.</b></summary>

The crawler finds only pages that another page links to. Add unlinked pages
as extra start points:

```yaml
routes:
  - /
  - /settings/profile
```

</details>

<details>
<summary><b>Some pages must never be visited.</b></summary>

Logout links and files (pdf, images, csv) are always skipped. Skip other
paths with `ignore`:

```yaml
ignore:
  - /admin
```

</details>

<details>
<summary><b>The build stopped at <code>maxPages</code>.</b></summary>

The crawler stops at 50 pages so dynamic routes (`/post/1`, `/post/2`, …)
cannot run forever. Raise the limit if needed:

```yaml
maxPages: 200
```

</details>

<details>
<summary><b>My pages need a login.</b></summary>

Send a session cookie:

```yaml
cookies:
  - session=your-session-cookie
```

</details>

<details>
<summary><b>Browser not found.</b></summary>

Use the Chrome you already have:

```yaml
channel: chrome
```

Or download Chromium once:

```bash
npx playwright install chromium
```

</details>

## Configuration

Every key is optional. Values below are the defaults. Unknown keys fail with
a clear error, so typos never pass silently.

```yaml
# capture
url: http://localhost:3000       # your running app
routes: [/]                      # crawl start points
ignore: []                       # path prefixes never visited
maxPages: 50                     # crawl limit
breakpoints: [375, 768, 1280]    # screen widths to capture
out: ./src/bones                 # output folder
wait: 800                        # ms to wait after page load
channel: chrome                  # optional: use installed Chrome
cookies: []                      # optional: name=value

# look (props on <Skeleton> override these)
animate: pulse                   # pulse | shimmer | solid
color: "#ececec"                 # light mode
darkColor: "#262626"             # dark mode (.dark class)
shimmerColor: "#f7f7f7"
darkShimmerColor: "#323232"
speed: 1.6s
```

## API

### `<Skeleton>`

| Prop | Required | Description |
| --- | --- | --- |
| `name` | yes | Unique name: letters, digits, `-`, `_` |
| `loading` | yes | `true` while data is loading |
| `fixture` | no | Sample content captured at build time |
| `animate`, `color`, `darkColor`, `shimmerColor`, `darkShimmerColor`, `speed` | no | Override `jiplak.yaml` for this skeleton |
| `options` | no | `{ exclude: ['.badge'] }` skips elements; `{ leafTags: ['section'] }` turns a tag into one bone |
| `bones` | no | Bones passed directly instead of the registry |
| `className` | no | Class for the wrapper element |

### Functions

| Function | Description |
| --- | --- |
| `registerBones(map)` | Register bones by name. The generated registry calls it. |
| `configureJiplak(theme)` | Set global look defaults. The generated registry calls it with your YAML values. |

### CLI

```bash
jiplak build [url] [--config jiplak.yaml]
```

## How it works

1. `jiplak build` opens your app in a headless browser, starting at
   `routes`, and follows links on the same origin.
2. At each breakpoint, every `<Skeleton>` on the page is captured. Text
   blocks, images, and controls become rectangles ("bones").
3. Bones are saved to `src/bones/<name>.bones.json`, plus a `registry.ts`
   that loads them.
4. At runtime, while `loading` is `true`, the bones are drawn over the hidden
   component, using the breakpoint that fits the container width.

## Development

```bash
bun install
bun test
bun run typecheck
bun run build
```

Issues and pull requests are welcome on
[GitHub](https://github.com/ItPohgero/jiplak/issues).

## Sponsor

<a href="https://lokio.link">
  <img src="https://raw.githubusercontent.com/ItPohgero/jiplak/main/.github/assets/lokio.png" alt="Lokio" width="72" />
</a>

jiplak is proudly sponsored by **[Lokio](https://lokio.link)**.

Like jiplak? Support its development:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/wahyuagusarifin)

## Author

**Wahyu Agus Arifin** · [@ItPohgero](https://github.com/ItPohgero)

## License

[MIT](./LICENSE) © 2026 Wahyu Agus Arifin
