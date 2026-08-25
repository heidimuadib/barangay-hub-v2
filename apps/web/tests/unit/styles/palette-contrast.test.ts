import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * US-UI-001 / DEC-UI-01 — the palettes, validated rather than asserted.
 *
 * This parses `globals.css` ITSELF. It does not compare against a fixture copy
 * of the values, because a fixture drifts: someone edits the stylesheet, the
 * test keeps checking the old numbers, and an unvalidated palette ships while
 * the suite stays green. The stylesheet is the input.
 *
 * Properties, from Phase 6 §4.9 / P6-C-D and from DEC-UI-01:
 *
 *   1. every accent's TEXT shade clears WCAG AA on white — and in fact AAA,
 *      because these are used for links and headings at ordinary weight;
 *   2. no two accents are so close that two barangays look like one brand;
 *   3. every `-700` clears AA against its own `-100` tint — the pairing that
 *      actually ships in a chip, which "on white" never measured;
 *   4. the DEFAULT brand is far from every semantic colour, so a primary button
 *      is never mistaken for an approved chip (DEC-UI-01);
 *   5. `brand-500` — the legacy hue — is provably unusable as text, which is
 *      what keeps it honest as a decoration-only token.
 *
 * The locked semantic colours are checked too. A tenant cannot change them,
 * which is exactly why a regression in one would be silent.
 */

// Resolved from the package root rather than `import.meta.url`: the jsdom
// environment does not give this module a `file:` URL.
const CSS = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8')

// ── Colour maths (sRGB → relative luminance → WCAG ratio; sRGB → CIE Lab) ───

function channels(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as [number, number, number]
}

function linearise(byte: number): number {
  const v = byte / 255
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map(linearise) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ]
  return (hi + 0.05) / (lo + 0.05)
}

function toLab(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex).map(linearise) as [number, number, number]
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

/** CIE76. Coarse, but far above the ~2.3 just-noticeable difference. */
function colourDistance(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a)
  const [l2, a2, b2] = toLab(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

// ── Extraction ──────────────────────────────────────────────────────────────

const WHITE = '#ffffff'

/** The `[data-accent='name'] { … }` blocks, in source order. */
function accentBlocks(): ReadonlyMap<string, string> {
  const blocks = new Map<string, string>()
  const pattern = /\[data-accent='([a-z]+)'\]\s*\{([^}]*)\}/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(CSS)) !== null) {
    if (match[1] && match[2]) blocks.set(match[1], match[2])
  }
  return blocks
}

function shadeIn(source: string, step: number): string | undefined {
  return new RegExp(`--color-brand-${step}:\\s*(#[0-9a-f]{6})`, 'i').exec(source)?.[1]
}

/**
 * The default ramp lives in `@theme`; the rest in `[data-accent='…']`.
 *
 * The default is labelled "green (default)" since DEC-UI-01 replaced the Slice 0a
 * teal with the legacy Barangay Hub green. The label is not cosmetic — it is
 * asserted below, so swapping the default without revisiting this file fails
 * here rather than quietly relabelling whatever is first in the file.
 */
function accentTextShades(): ReadonlyMap<string, string> {
  const found = new Map<string, string>()

  const theDefault = shadeIn(CSS, 700)
  if (theDefault !== undefined) found.set('green (default)', theDefault)

  for (const [name, block] of accentBlocks()) {
    const shade = shadeIn(block, 700)
    if (shade !== undefined) found.set(name, shade)
  }
  return found
}

function semanticTextShades(): ReadonlyMap<string, string> {
  const found = new Map<string, string>()
  const pattern = /--color-(success|warning|danger|info|neutral)-(\d{3}):\s*(#[0-9a-f]{6})/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(CSS)) !== null) {
    // 700 is the text shade throughout; neutral-500 is the documented minimum
    // for body text and is checked with it.
    if (match[2] === '700' || (match[1] === 'neutral' && match[2] === '500')) {
      found.set(`${match[1]}-${match[2]}`, match[3] as string)
    }
  }
  return found
}

/**
 * `-700` text over its own `-100` fill, for every tone that ships as a chip or
 * an inline alert. This is the pairing a user actually sees; measuring each
 * colour against a white it never sits on was the gap here before UI-A.
 */
function tintedPairs(): ReadonlyMap<string, { text: string; fill: string }> {
  const pairs = new Map<string, { text: string; fill: string }>()
  for (const tone of ['success', 'warning', 'danger', 'info'] as const) {
    const text = new RegExp(`--color-${tone}-700:\\s*(#[0-9a-f]{6})`, 'i').exec(CSS)?.[1]
    const fill = new RegExp(`--color-${tone}-100:\\s*(#[0-9a-f]{6})`, 'i').exec(CSS)?.[1]
    if (text !== undefined && fill !== undefined) pairs.set(tone, { text, fill })
  }
  const brandText = shadeIn(CSS, 700)
  const brandFill = shadeIn(CSS, 100)
  if (brandText !== undefined && brandFill !== undefined) {
    pairs.set('brand', { text: brandText, fill: brandFill })
  }
  return pairs
}

const accents = accentTextShades()
const semantics = semanticTextShades()
const pairs = tintedPairs()
const MINIMUM_DISTANCE = 15

describe('US-UI-001 — the palettes exist and were parsed', () => {
  it('finds the default plus seven curated accents', () => {
    // If this drops, the stylesheet changed shape and every assertion below
    // would be vacuously passing over an empty set.
    expect(accents.size).toBe(8)
    expect([...accents.keys()]).toContain('green (default)')
  })

  it('no longer offers teal or forest as tenant accents', () => {
    // DEC-UI-01: teal became the SUCCESS colour, so it cannot also be a brand;
    // forest sat ΔE 6.7 from the new default green. Asserted as an ABSENCE so
    // neither can be reinstated without this test objecting.
    expect([...accents.keys()]).not.toContain('teal')
    expect([...accents.keys()]).not.toContain('forest')
  })

  it('finds the locked semantic text shades', () => {
    expect(semantics.size).toBeGreaterThanOrEqual(5)
  })

  it('gives every accent its own decorative -500', () => {
    // The shells use `brand-500` for gradients and icon plates. Without a
    // per-accent value, a maroon-branded barangay would inherit the default
    // green's decoration — a bug that looks like a design choice.
    const missing = [...accentBlocks().entries()]
      .filter(([, block]) => shadeIn(block, 500) === undefined)
      .map(([name]) => name)
    expect(missing).toEqual([])
    expect(shadeIn(CSS, 500)).toBeDefined()
  })
})

describe('US-UI-001 — contrast', () => {
  it.each([...accents.entries()])('accent %s clears AAA on white', (name, hex) => {
    const ratio = contrastRatio(hex, WHITE)
    expect(ratio, `${name} (${hex}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(7)
  })

  it.each([...semantics.entries()])('semantic %s clears AA on white', (name, hex) => {
    const ratio = contrastRatio(hex, WHITE)
    expect(ratio, `${name} (${hex}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
  })

  it.each([...pairs.entries()])('%s reads on its own tint', (name, { text, fill }) => {
    const ratio = contrastRatio(text, fill)
    expect(ratio, `${name}: ${text} on ${fill} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
      4.5,
    )
  })

  it('never uses neutral-400 as a text colour — it is decorative only', () => {
    const decorative = /--color-neutral-400:\s*(#[0-9a-f]{6})/i.exec(CSS)?.[1]
    expect(decorative).toBeDefined()
    // Asserted as a FAILURE: this documents why the token is marked
    // decorative, so nobody "fixes" the comment by using it for text.
    expect(contrastRatio(decorative as string, WHITE)).toBeLessThan(4.5)
  })

  it('keeps the legacy brand-500 hue out of reach of text (DEC-UI-01)', () => {
    // #319366 is the colour the legacy dashboards branded with, and it is
    // 3.82:1 on white — under AA. DEC-UI-01 admits it as a surface token only.
    // Asserted as a failure for the same reason as neutral-400: the moment this
    // passes 4.5:1 somebody will reasonably start using it for a label.
    const surface = shadeIn(CSS, 500)
    expect(surface).toBeDefined()
    const ratio = contrastRatio(surface as string, WHITE)
    expect(ratio, `brand-500 (${surface}) is ${ratio.toFixed(2)}:1`).toBeLessThan(4.5)
  })

  it('carries white text on both sidebar gradient stops', () => {
    // The shell gradient runs brand-700 → brand-800 with white labels on it.
    // Legacy ran #319366 → #26734f and put white labels at 3.82:1; this is the
    // assertion that stops that being reintroduced as "the legacy look".
    for (const step of [700, 800]) {
      const stop = shadeIn(CSS, step)
      expect(stop, `brand-${step} is defined`).toBeDefined()
      const ratio = contrastRatio(WHITE, stop as string)
      expect(
        ratio,
        `white on brand-${step} (${stop}) is ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('US-UI-001 — colour distance', () => {
  /**
   * ΔE ≥ 15, not the 20 first attempted.
   *
   * Every accent must also clear 7:1 on white, which confines all eight to the
   * dark end of the space and caps how far apart they can get: the closest
   * admissible pair across several candidate sets was ~18. Choosing 15 states
   * the real constraint instead of quietly relaxing the contrast requirement,
   * which is the one that actually serves users. It remains ~6× the just-
   * noticeable difference.
   */
  it('keeps every pair of accents visibly distinct', () => {
    const entries = [...accents.entries()]
    const tooClose: string[] = []

    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const [nameA, hexA] = entries[i] as [string, string]
        const [nameB, hexB] = entries[j] as [string, string]
        const distance = colourDistance(hexA, hexB)
        if (distance < MINIMUM_DISTANCE) {
          tooClose.push(`${nameA} vs ${nameB}: ΔE ${distance.toFixed(1)}`)
        }
      }
    }

    expect(tooClose).toEqual([])
  })

  it('keeps every accent distinct from the danger colour', () => {
    // An accent that reads as the rejection colour would make a barangay's own
    // branding look like an error state.
    const danger = semantics.get('danger-700')
    expect(danger).toBeDefined()

    for (const [name, hex] of accents) {
      const distance = colourDistance(hex, danger as string)
      expect(distance, `${name} is ΔE ${distance.toFixed(1)} from danger`).toBeGreaterThanOrEqual(
        MINIMUM_DISTANCE,
      )
    }
  })

  /**
   * DEC-UI-01: "do not conflate brand green with semantic success green."
   *
   * This is the assertion that forced `success` from #166534 to #115e59. Against
   * the new default green, the old success sat at ΔE 9.8 — a primary button and
   * an approved chip would have been the same colour to a user, and the only
   * thing distinguishing "submit" from "approved" would have been position.
   *
   * Scoped to the DEFAULT accent rather than all eight, deliberately. It is the
   * one every barangay sees unless it chooses otherwise, and widening the rule
   * would evict a tenant accent that DEC-UI-01 did not ask to change — see the
   * indigo/info note in the risk register.
   */
  it('keeps the default brand distinct from every semantic colour', () => {
    const brand = accents.get('green (default)')
    expect(brand).toBeDefined()

    for (const [name, hex] of semantics) {
      if (name === 'neutral-500') continue
      const distance = colourDistance(brand as string, hex)
      expect(
        distance,
        `default brand is ΔE ${distance.toFixed(1)} from ${name} (${hex})`,
      ).toBeGreaterThanOrEqual(MINIMUM_DISTANCE)
    }
  })

  it('keeps the semantic colours distinct from each other', () => {
    const entries = [...semantics.entries()].filter(([name]) => name !== 'neutral-500')
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const [nameA, hexA] = entries[i] as [string, string]
        const [nameB, hexB] = entries[j] as [string, string]
        const distance = colourDistance(hexA, hexB)
        expect(distance, `${nameA} vs ${nameB}: ΔE ${distance.toFixed(1)}`).toBeGreaterThanOrEqual(
          MINIMUM_DISTANCE,
        )
      }
    }
  })
})
