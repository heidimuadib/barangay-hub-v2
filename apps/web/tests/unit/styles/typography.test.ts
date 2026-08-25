import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * UI-A — the typeface is actually loaded, and nothing reaches for a CDN.
 *
 * `globals.css` named Inter in `--font-sans` from Slice 0a onwards, and nothing
 * ever loaded it: no `next/font` call, no `@font-face`, no font file. Every
 * screen rendered in the OS fallback, and the failure was invisible because the
 * stack ends in `system-ui` — a declared identity that was never applied.
 *
 * A test that renders a component cannot catch that; jsdom has no font stack and
 * would pass either way. So this parses the source, in the manner of the palette
 * test: the files are the input, and the assertions are about the wiring
 * between them.
 *
 * It also guards the CSP. DEC-UI-01 rules out CDN dependencies, and
 * `middleware.ts` enforces `font-src 'self'` and a script nonce — but a
 * stylesheet `@import` of fonts.googleapis.com fails silently in production
 * while looking correct in review. Legacy loaded Tailwind, Font Awesome and two
 * Google Font families from four different CDNs; this is the assertion that
 * keeps any of them from following the design over.
 */

const root = process.cwd()
const CSS = readFileSync(resolve(root, 'src/styles/globals.css'), 'utf8')
const LAYOUT = readFileSync(resolve(root, 'src/app/layout.tsx'), 'utf8')

describe('UI-A — the sans typeface is self-hosted and wired up', () => {
  it('loads the face through next/font/local', () => {
    expect(LAYOUT).toMatch(/from 'next\/font\/local'/)
    expect(LAYOUT).toMatch(/localFont\(/)
  })

  it('points at a woff2 that exists in the repository', () => {
    const src = /src:\s*'([^']+\.woff2)'/.exec(LAYOUT)?.[1]
    expect(src, 'the localFont call names a woff2 file').toBeDefined()

    // Resolved the way Next resolves it: relative to the file making the call.
    const onDisk = resolve(root, 'src/app', src as string)
    expect(existsSync(onDisk), `${src} resolves to ${onDisk}`).toBe(true)
  })

  it('exposes the face as the CSS variable the theme consumes', () => {
    // Two halves of one wiring: the layout publishes `--font-inter` on <html>,
    // and the theme's `--font-sans` reads it. Either alone is inert.
    expect(LAYOUT).toMatch(/variable:\s*'--font-inter'/)
    expect(LAYOUT).toMatch(/className=\{inter\.variable\}/)
    expect(CSS).toMatch(/--font-sans:\s*\n?\s*var\(--font-inter\)/)
  })

  it('keeps a fallback stack behind the variable font', () => {
    // A variable font can still fail to load; the stack must not end at the
    // custom family.
    expect(CSS).toMatch(/var\(--font-inter\),[\s\S]*?system-ui/)
    expect(LAYOUT).toMatch(/fallback:\s*\[/)
  })

  it('adjusts the fallback metrics so the swap does not reflow', () => {
    expect(LAYOUT).toMatch(/adjustFontFallback:/)
    expect(LAYOUT).toMatch(/display:\s*'swap'/)
  })

  it('declares a heading and body scale rather than ad-hoc sizes', () => {
    for (const token of [
      '--text-body-resident',
      '--text-body-staff',
      '--text-dense',
      '--text-eyebrow',
    ]) {
      expect(CSS, `${token} is defined`).toContain(token)
    }
  })
})

describe('UI-A — no CSP-breaking third-party asset', () => {
  const FORBIDDEN = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdn.tailwindcss.com',
    'cdnjs.cloudflare.com',
    'kit.fontawesome.com',
    'cdn.jsdelivr.net',
    'unpkg.com',
  ]

  it.each(FORBIDDEN)('the stylesheet does not reference %s', (host) => {
    expect(CSS).not.toContain(host)
  })

  it.each(FORBIDDEN)('the root layout does not reference %s', (host) => {
    expect(LAYOUT).not.toContain(host)
  })

  it('imports no remote stylesheet at all', () => {
    // `@import 'tailwindcss'` is a package, not a URL. Anything with a scheme or
    // a protocol-relative prefix is remote.
    const remoteImports = [...CSS.matchAll(/@import\s+(?:url\()?['"]?([^'")\s]+)/g)]
      .map((match) => match[1] as string)
      .filter((target) => /^(https?:)?\/\//.test(target))
    expect(remoteImports).toEqual([])
  })

  it('states the browser theme colour as an accessible brand shade', () => {
    // Not the decorative `brand-500` (#319366, 3.82:1): the browser paints UI
    // chrome with this, and it should match the shade that carries text.
    expect(LAYOUT).toMatch(/themeColor:\s*'#15603f'/)
  })
})
